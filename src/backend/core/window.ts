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
      // Note: sandbox: false is already implicit with nodeIntegration: true
      // This allows Web Speech API to access Windows SAPI5 voices
    }
  });

  setupContentSecurityPolicy(mainWindow);

  // Handle voices-changed event to ensure voices are properly loaded
  mainWindow.webContents.on('did-finish-load', () => {
    // Trigger Web Speech API voice loading
    // This ensures Windows SAPI5 voices are properly initialized
    mainWindow.webContents.executeJavaScript(`
      if (window.speechSynthesis) {
        // Request voices to trigger the voices-changed event
        const voices = window.speechSynthesis.getVoices();
        console.log('[Main] Web Speech API initialized with', voices.length, 'voices');
      }
    `);
  });

  // __dirname will be dist/backend/core, so go up to dist root, then to frontend
  mainWindow.loadFile(path.join(__dirname, '../../frontend/index.html'));

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  return mainWindow;
}
