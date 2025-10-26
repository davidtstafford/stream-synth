import { BrowserWindow } from 'electron';
import * as path from 'path';
import { setupContentSecurityPolicy } from '../security/csp';
import { PlatformTTSFactory } from './platform-tts-factory';

export async function createMainWindow(): Promise<BrowserWindow> {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true
      // Note: sandbox: false is already implicit with nodeIntegration: true
      // This allows Web Speech API to access system voices (SAPI5 on Windows, AVFoundation on macOS)
    }
  });

  setupContentSecurityPolicy(mainWindow);

  // Initialize platform-specific TTS handler
  // This handles OS-specific Web Speech API initialization
  try {
    await PlatformTTSFactory.initialize(mainWindow);
  } catch (error) {
    console.error('[Main] Error initializing platform TTS handler:', error);
  }
  // __dirname will be dist/backend/core, so go up to dist root, then to frontend
  mainWindow.loadFile(path.join(__dirname, '../../frontend/index.html'));

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  return mainWindow;
}
