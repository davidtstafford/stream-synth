import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './window';
import { setupIpcHandlers, setMainWindow } from './ipc-handlers';

let mainWindow: BrowserWindow | null = null;

function initialize(): void {
  mainWindow = createMainWindow();
  setMainWindow(mainWindow);
  setupIpcHandlers();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', initialize);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    initialize();
  }
});

