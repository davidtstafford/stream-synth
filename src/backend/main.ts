import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './core/window';
import { setupAllIpcHandlers, runStartupTasks } from './core/ipc-handlers';
import { PlatformTTSFactory } from './core/platform-tts';
import { initializeDatabase, closeDatabase } from './database/connection';
import { ViewerTTSRulesRepository } from './database/repositories/viewer-tts-rules';

let mainWindow: BrowserWindow | null = null;
let cleanupInterval: NodeJS.Timeout | null = null;

async function initialize(): Promise<void> {
  // Initialize database first
  initializeDatabase();
  
  // Start background cleanup job for expired TTS rules (every 5 minutes)
  const viewerTTSRulesRepo = new ViewerTTSRulesRepository();
  cleanupInterval = setInterval(() => {
    try {
      viewerTTSRulesRepo.cleanupExpiredRules();
    } catch (error) {
      console.error('[Main] Error running TTS rules cleanup:', error);
    }
  }, 5 * 60 * 1000); // 5 minutes
  
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
  // Stop cleanup interval
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  
  // Cleanup platform TTS handler
  try {
    await PlatformTTSFactory.cleanup();
  } catch (error) {
    console.error('Error cleaning up TTS handler:', error);
  }
  
  closeDatabase();
});

