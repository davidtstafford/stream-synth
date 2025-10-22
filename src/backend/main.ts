import { app, BrowserWindow, ipcMain, session } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true
    }
  });

  // Set Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    // Only apply CSP to local files, not external pages like Twitch
    if (details.url.startsWith('file://')) {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' https://api.twitch.tv https://id.twitch.tv wss://eventsub.wss.twitch.tv; script-src 'self' 'unsafe-inline' 'unsafe-eval'"]
        }
      });
    } else {
      callback({ responseHeaders: details.responseHeaders });
    }
  });

  // Load the HTML file
  mainWindow.loadFile(path.join(__dirname, '../frontend/index.html'));

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Handle Twitch OAuth
ipcMain.handle('twitch-oauth', async (event, clientId: string) => {
  const authWindow = new BrowserWindow({
    width: 800,
    height: 600,
    parent: mainWindow || undefined,
    modal: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Don't set CSP for auth window - Twitch needs to load its scripts
  
  const redirectUri = 'http://localhost:3300/auth/twitch/callback';
  // Request all necessary scopes for EventSub subscriptions
  const scope = [
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
    'bits:read',
    'channel:read:charity'
  ].join(' ');
  const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=${encodeURIComponent(scope)}`;

  authWindow.loadURL(authUrl);

  return new Promise((resolve, reject) => {
    // Listen for navigation events to catch the redirect with the token
    const handleNavigation = (event: any, url: string) => {
      if (url.startsWith('http://localhost:3300/auth/twitch/callback')) {
        event.preventDefault();
        
        // The token is in the URL fragment (after #)
        const urlObj = new URL(url);
        const hash = urlObj.hash.substring(1); // Remove the # symbol
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        
        if (accessToken) {
          resolve({ success: true, accessToken });
          authWindow.close();
        } else {
          reject(new Error('Failed to get access token'));
          authWindow.close();
        }
      }
    };

    // Try both events as Twitch might use either depending on the flow
    authWindow.webContents.on('will-redirect', handleNavigation);
    authWindow.webContents.on('will-navigate', handleNavigation);
    authWindow.webContents.on('did-navigate', handleNavigation);

    authWindow.on('closed', () => {
      reject(new Error('Authentication window closed'));
    });
  });
});

// Handle WebSocket connection
ipcMain.handle('connect-websocket', async (event, token: string) => {
  // This will be used to establish WebSocket connection
  return { success: true, message: 'WebSocket connection initiated' };
});

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
