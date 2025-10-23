import { ipcMain, BrowserWindow } from 'electron';
import { authenticateWithTwitch } from '../auth/twitch-oauth';
import { SettingsRepository } from '../database/repositories/settings';
import { SessionsRepository } from '../database/repositories/sessions';
import { EventsRepository } from '../database/repositories/events';
import { TokensRepository } from '../database/repositories/tokens';
import { exportSettings, importSettings, getExportPreview } from '../services/export-import';
import { twitchIRCService } from '../services/twitch-irc';

let mainWindow: BrowserWindow | null = null;

// Initialize repositories
const settingsRepo = new SettingsRepository();
const sessionsRepo = new SessionsRepository();
const eventsRepo = new EventsRepository();
const tokensRepo = new TokensRepository();

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

  // Database: Settings
  ipcMain.handle('db:get-setting', async (event, key: string) => {
    return settingsRepo.get(key);
  });

  ipcMain.handle('db:set-setting', async (event, key: string, value: string) => {
    settingsRepo.set(key, value);
    return { success: true };
  });

  ipcMain.handle('db:get-all-settings', async () => {
    return settingsRepo.getAll();
  });

  // Database: Sessions
  ipcMain.handle('db:create-session', async (event, session: any) => {
    const id = sessionsRepo.create(session);
    return { success: true, id };
  });

  ipcMain.handle('db:get-current-session', async () => {
    return sessionsRepo.getCurrentSession();
  });

  ipcMain.handle('db:end-current-session', async () => {
    sessionsRepo.endCurrentSession();
    return { success: true };
  });

  ipcMain.handle('db:get-recent-sessions', async (event, limit: number = 10) => {
    return sessionsRepo.getRecentSessions(limit);
  });

  // Database: Event Subscriptions
  ipcMain.handle('db:save-subscription', async (event, userId: string, channelId: string, eventType: string, isEnabled: boolean) => {
    eventsRepo.saveSubscription(userId, channelId, eventType, isEnabled);
    return { success: true };
  });

  ipcMain.handle('db:get-subscriptions', async (event, userId: string, channelId: string) => {
    return eventsRepo.getSubscriptions(userId, channelId);
  });

  ipcMain.handle('db:get-enabled-events', async (event, userId: string, channelId: string) => {
    return eventsRepo.getEnabledEvents(userId, channelId);
  });

  ipcMain.handle('db:clear-subscriptions', async (event, userId: string, channelId: string) => {
    eventsRepo.clearSubscriptions(userId, channelId);
    return { success: true };
  });

  // Database: OAuth Tokens
  ipcMain.handle('db:save-token', async (event, token: any) => {
    tokensRepo.save(token);
    return { success: true };
  });

  ipcMain.handle('db:get-token', async (event, userId: string) => {
    return tokensRepo.get(userId);
  });

  ipcMain.handle('db:invalidate-token', async (event, userId: string) => {
    tokensRepo.invalidate(userId);
    return { success: true };
  });

  ipcMain.handle('db:delete-token', async (event, userId: string) => {
    tokensRepo.delete(userId);
    return { success: true };
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

  // IRC: Connect
  ipcMain.handle('irc:connect', async (event, username: string, token: string, channel?: string) => {
    try {
      await twitchIRCService.connect(username, token, channel);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // IRC: Disconnect
  ipcMain.handle('irc:disconnect', async () => {
    try {
      await twitchIRCService.disconnect();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // IRC: Send message
  ipcMain.handle('irc:send-message', async (event, message: string, channel?: string) => {
    try {
      await twitchIRCService.sendMessage(message, channel);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // IRC: Get status
  ipcMain.handle('irc:get-status', async () => {
    return twitchIRCService.getStatus();
  });

  // IRC: Join channel
  ipcMain.handle('irc:join-channel', async (event, channel: string) => {
    try {
      await twitchIRCService.joinChannel(channel);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // IRC: Leave channel
  ipcMain.handle('irc:leave-channel', async (event, channel: string) => {
    try {
      await twitchIRCService.leaveChannel(channel);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // IRC: Forward events to renderer
  twitchIRCService.on('chat.join', (event) => {
    mainWindow?.webContents.send('irc:chat-join', event);
  });

  twitchIRCService.on('chat.part', (event) => {
    mainWindow?.webContents.send('irc:chat-part', event);
  });

  twitchIRCService.on('status', (status) => {
    mainWindow?.webContents.send('irc:status', status);
  });
}
