import { BrowserWindow } from 'electron';

const TWITCH_SCOPES = [
  'user:read:email',
  'user:read:chat',
  'chat:read',
  'chat:edit',
  'channel:read:subscriptions',
  'channel:read:redemptions',
  'channel:read:hype_train',
  'channel:read:polls',
  'channel:read:predictions',
  'channel:read:goals',
  'channel:manage:raids',
  'moderator:read:followers',
  'moderator:read:chatters',
  'moderator:read:shield_mode',
  'moderator:read:shoutouts',
  'moderator:manage:shoutouts',
  'moderator:read:banned_users',  // For channel.ban and channel.unban events
  'moderator:read:moderators',    // For channel.moderator.add and channel.moderator.remove events
  'channel:read:vips',            // For VIP sync and viewer role management
  'bits:read',
  'channel:read:charity'
];

const REDIRECT_URI = 'http://localhost:3300/auth/twitch/callback';

export async function authenticateWithTwitch(
  clientId: string,
  parentWindow: BrowserWindow | null
): Promise<string> {
  return new Promise((resolve, reject) => {
    const authWindow = new BrowserWindow({
      width: 800,
      height: 600,
      parent: parentWindow || undefined,
      modal: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    const scope = TWITCH_SCOPES.join(' ');
    const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${REDIRECT_URI}&response_type=token&scope=${encodeURIComponent(scope)}`;

    authWindow.loadURL(authUrl);

    let handled = false;

    // Listen for navigation events to catch the redirect with the token
    const handleNavigation = (event: any, url: string) => {
      if (url.startsWith(REDIRECT_URI)) {
        event.preventDefault();
        
        if (handled) return;
        handled = true;

        const urlObj = new URL(url);
        const hash = urlObj.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const error = params.get('error');
        
        if (accessToken) {
          resolve(accessToken);
          authWindow.close();
        } else if (error) {
          reject(new Error(`Twitch OAuth error: ${error}`));
          authWindow.close();
        } else {
          reject(new Error('Failed to get access token from Twitch'));
          authWindow.close();
        }
      }
    };

    authWindow.webContents.on('will-redirect', handleNavigation);
    authWindow.webContents.on('will-navigate', handleNavigation);
    authWindow.webContents.on('did-navigate', handleNavigation);

    authWindow.on('closed', () => {
      if (!handled) {
        handled = true;
        reject(new Error('Authentication window was closed'));
      }
    });
  });
}
