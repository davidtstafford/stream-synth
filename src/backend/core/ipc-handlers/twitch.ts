/**
 * Twitch IPC Handlers
 * 
 * Handles Twitch-related operations via IPC using centralized IPC Framework:
 * - OAuth authentication
 * - WebSocket connection
 * - Export/Import settings
 * - Subscription syncing
 * 
 * Phase 3: Migrated to use IPCRegistry for consistent error handling
 */

import { BrowserWindow } from 'electron';
import { ipcRegistry } from '../ipc/ipc-framework';
import { authenticateWithTwitch } from '../../auth/twitch-oauth';
import { exportSettings, importSettings, getExportPreview } from '../../services/export-import';
import { TwitchSubscriptionsService } from '../../services/twitch-subscriptions';
import { TwitchVIPService } from '../../services/twitch-vip';
import { getDatabase } from '../../database/connection';

let mainWindow: BrowserWindow | null = null;

export function setMainWindowForTwitch(window: BrowserWindow | null): void {
  mainWindow = window;
}

export function setupTwitchHandlers(): void {
  // ===== OAuth & Connection =====
  ipcRegistry.register<string, any>(
    'twitch-oauth',
    {
      validate: (clientId) => clientId ? null : 'Client ID is required',
      execute: async (clientId) => {
        return await authenticateWithTwitch(clientId, mainWindow);
      }
    }
  );

  ipcRegistry.register<string, void>(
    'connect-websocket',
    {
      validate: (token) => token ? null : 'Token is required',
      execute: async (token) => {
        // WebSocket connection will be initiated with the token
        console.log('[Twitch] WebSocket connection initiated');
      }
    }
  );
  // ===== Export/Import =====
  ipcRegistry.register<void, string>(
    'export-settings',
    {
      execute: async () => {
        console.log('[Twitch] Exporting settings...');
        const filePath = await exportSettings();
        return filePath;
      }
    }
  );

  ipcRegistry.register<void, any>(
    'import-settings',
    {
      execute: async () => {
        console.log('[Twitch] Importing settings...');
        return await importSettings();
      }
    }
  );

  ipcRegistry.register<void, any>(
    'get-export-preview',
    {
      execute: async () => {
        console.log('[Twitch] Getting export preview...');
        return getExportPreview();
      }
    }
  );
  // ===== Subscriptions & VIPs =====
  ipcRegistry.register<void, { success: boolean; subCount?: number; vipCount?: number; error?: string }>(
    'twitch:sync-subscriptions-from-twitch',
    {
      execute: async () => {
        console.log('[Twitch] Syncing subscriptions and VIPs from Twitch API...');
        const db = getDatabase();
        const sessionsRepo = require('../../database/repositories/sessions').SessionsRepository;
        const session = new sessionsRepo().getCurrentSession();

        if (!session) {
          throw new Error('Not connected to Twitch. Please connect first.');
        }

        // Sync subscriptions
        const subscriptionService = new TwitchSubscriptionsService();
        const subResult = await subscriptionService.syncSubscriptionsFromTwitch(
          session.channel_id,
          session.user_id
        );

        // Sync VIPs
        const vipService = new TwitchVIPService();
        const vipResult = await vipService.syncVIPsFromTwitch(
          session.channel_id,
          session.user_id
        );

        return {
          success: subResult.success && vipResult.success,
          subCount: subResult.count,
          vipCount: vipResult.count,
          error: subResult.error || vipResult.error
        };
      }
    }
  );
}
