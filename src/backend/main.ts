import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './core/window';
import { setupAllIpcHandlers, runStartupTasks } from './core/ipc-handlers';
import { PlatformTTSFactory } from './core/platform-tts';
import { initializeDatabase, closeDatabase } from './database/connection';

let mainWindow: BrowserWindow | null = null;

async function initialize(): Promise<void> {
  // Initialize database first
  initializeDatabase();
  
  mainWindow = await createMainWindow();
  setupAllIpcHandlers(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // Run startup tasks after window is ready
  mainWindow.webContents.on('did-finish-load', () => {
    runStartupTasks();
  });
}

app.on('ready', initialize);

app.on('window-all-closed', () => {
  closeDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    initialize();
  }
});

app.on('before-quit', async () => {
  // Cleanup platform TTS handler
  try {
    await PlatformTTSFactory.cleanup();
  } catch (error) {
    console.error('Error cleaning up TTS handler:', error);
  }
  
  closeDatabase();
});

