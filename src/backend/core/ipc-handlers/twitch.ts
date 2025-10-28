/**
 * Twitch IPC Handlers
 * 
 * Handles Twitch-related operations via IPC:
 * - OAuth authentication
 * - WebSocket connection
 * - Export/Import settings
 */

import { ipcMain, BrowserWindow } from 'electron';
import { authenticateWithTwitch } from '../../auth/twitch-oauth';
import { exportSettings, importSettings, getExportPreview } from '../../services/export-import';
import { TwitchSubscriptionsService } from '../../services/twitch-subscriptions';
import { getDatabase } from '../../database/connection';

let mainWindow: BrowserWindow | null = null;

export function setMainWindowForTwitch(window: BrowserWindow | null): void {
  mainWindow = window;
}

export function setupTwitchHandlers(): void {
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

  // Export/Import
  ipcMain.handle('export-settings', async () => {
    try {
      const filePath = await exportSettings();
      return { success: true, filePath };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('import-settings', async () => {
    try {
      const result = await importSettings();
      return result;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle('get-export-preview', async () => {
    try {
      const preview = getExportPreview();
      return { success: true, preview };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Sync Subscriptions from Twitch
  ipcMain.handle('twitch:sync-subscriptions-from-twitch', async () => {
    try {
      console.log('[Twitch] Syncing subscriptions from Twitch API...');
      const db = getDatabase();
      const sessionsRepo = require('../../database/repositories/sessions').SessionsRepository;
      const session = new sessionsRepo().getCurrentSession();

      if (!session) {
        return { success: false, error: 'Not connected to Twitch. Please connect first.' };
      }

      const subscriptionService = new TwitchSubscriptionsService();
      const result = await subscriptionService.syncSubscriptionsFromTwitch(
        session.channel_id,
        session.user_id
      );

      return result;
    } catch (error: any) {
      console.error('[Twitch] Error syncing subscriptions:', error);
      return { success: false, error: error.message };
    }
  });
}
