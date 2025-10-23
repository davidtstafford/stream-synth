import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './core/window';
import { setupIpcHandlers, setMainWindow, runStartupTasks } from './core/ipc-handlers';
import { initializeDatabase, closeDatabase } from './database/connection';

let mainWindow: BrowserWindow | null = null;

function initialize(): void {
  // Initialize database first
  initializeDatabase();
  
  mainWindow = createMainWindow();
  setMainWindow(mainWindow);
  setupIpcHandlers();

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

app.on('before-quit', () => {
  closeDatabase();
});

