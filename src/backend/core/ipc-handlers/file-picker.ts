/**
 * File Picker IPC Handlers
 * Provides file selection dialogs for sound, image, and video files
 */

import { ipcMain, dialog, BrowserWindow } from 'electron';

let mainWindow: BrowserWindow | null = null;

export function setMainWindowForFilePicker(window: BrowserWindow): void {
  mainWindow = window;
}

export function setupFilePickerHandlers(): void {
  /**
   * Open file picker dialog
   * @param event - IPC event
   * @param options - Dialog options including file filters
   * @returns Selected file path or null if cancelled
   */
  ipcMain.handle('file:open-dialog', async (event, options: any) => {
    if (!mainWindow) {
      throw new Error('Main window not available');
    }

    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: options.filters || [],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      return result.filePaths[0]; // Return the first selected file path
    } catch (error) {
      console.error('[FilePickerHandler] Error opening file dialog:', error);
      throw error;
    }
  });
}
