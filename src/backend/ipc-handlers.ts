import { ipcMain, BrowserWindow } from 'electron';
import { authenticateWithTwitch } from './auth/twitch-oauth';

let mainWindow: BrowserWindow | null = null;

export function setMainWindow(window: BrowserWindow): void {
  mainWindow = window;
}

export function setupIpcHandlers(): void {
  // Handle Twitch OAuth
  ipcMain.handle('twitch-oauth', async (event, clientId: string) => {
    try {
      const result = await authenticateWithTwitch(clientId, mainWindow);
      return result;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Handle WebSocket connection
  ipcMain.handle('connect-websocket', async (event, token: string) => {
    // This will be used to establish WebSocket connection
    return { success: true, message: 'WebSocket connection initiated' };
  });
}
