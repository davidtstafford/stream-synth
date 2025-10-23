import { BrowserWindow } from 'electron';
import * as path from 'path';
import { setupContentSecurityPolicy } from '../security/csp';

export function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true
    }
  });

  setupContentSecurityPolicy(mainWindow);

  // __dirname will be dist/backend/core, so go up to dist root, then to frontend
  mainWindow.loadFile(path.join(__dirname, '../../frontend/index.html'));

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  return mainWindow;
}
