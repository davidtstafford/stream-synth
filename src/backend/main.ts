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

  const redirectUri = 'http://localhost';
  const scope = 'user:read:email chat:read chat:edit';
  const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=${encodeURIComponent(scope)}`;

  authWindow.loadURL(authUrl);

  return new Promise((resolve, reject) => {
    authWindow.webContents.on('will-redirect', (event, url) => {
      if (url.startsWith(redirectUri)) {
        event.preventDefault();
        const hash = url.split('#')[1];
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        
        if (accessToken) {
          resolve({ success: true, accessToken });
        } else {
          reject(new Error('Failed to get access token'));
        }
        authWindow.close();
      }
    });

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
