import { ipcMain, BrowserWindow } from 'electron';
import { authenticateWithTwitch } from '../auth/twitch-oauth';
import { SettingsRepository } from '../database/repositories/settings';
import { SessionsRepository } from '../database/repositories/sessions';
import { EventsRepository } from '../database/repositories/events';
import { TokensRepository } from '../database/repositories/tokens';
import { ViewersRepository } from '../database/repositories/viewers';
import { exportSettings, importSettings, getExportPreview } from '../services/export-import';
import { twitchIRCService } from '../services/twitch-irc';
import { TTSManager } from '../services/tts/manager';
import { getDatabase } from '../database/connection';

let mainWindow: BrowserWindow | null = null;

// Initialize repositories
const settingsRepo = new SettingsRepository();
const sessionsRepo = new SessionsRepository();
const eventsRepo = new EventsRepository();
const tokensRepo = new TokensRepository();
const viewersRepo = new ViewersRepository();

// Initialize TTS Manager
let ttsManager: TTSManager | null = null;

async function initializeTTS() {
  if (!ttsManager) {
    const db = getDatabase();
    ttsManager = new TTSManager(db);
    await ttsManager.initialize();
  }
  return ttsManager;
}

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

  // Database: Store Event
  ipcMain.handle('db:store-event', async (event, eventType: string, eventData: any, channelId: string, viewerId?: string) => {
    try {
      const id = eventsRepo.storeEvent(eventType, eventData, channelId, viewerId);
      
      // Send event to renderer for real-time updates
      const storedEvent = {
        id,
        event_type: eventType,
        event_data: eventData,
        channel_id: channelId,
        viewer_id: viewerId,
        created_at: new Date().toISOString()
      };
      
      // Add viewer info if available
      if (viewerId) {
        const viewer = viewersRepo.getById(viewerId);
        if (viewer) {
          (storedEvent as any).viewer_username = viewer.username;
          (storedEvent as any).viewer_display_name = viewer.display_name;
        }
      }
      
      mainWindow?.webContents.send('event:stored', storedEvent);
      
      return { success: true, id };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Database: Get Events
  ipcMain.handle('db:get-events', async (event, filters: any) => {
    try {
      const events = eventsRepo.getEvents(filters);
      return { success: true, events };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Database: Get Chat Events
  ipcMain.handle('db:get-chat-events', async (event, channelId: string, limit?: number) => {
    try {
      const events = eventsRepo.getChatEvents(channelId, limit);
      return { success: true, events };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Database: Get Event Count
  ipcMain.handle('db:get-event-count', async (event, channelId?: string, eventType?: string) => {
    try {
      const count = eventsRepo.getEventCount(channelId, eventType);
      return { success: true, count };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Database: Viewers - Get or Create
  ipcMain.handle('db:get-or-create-viewer', async (event, id: string, username: string, displayName?: string) => {
    try {
      const viewer = viewersRepo.getOrCreate(id, username, displayName);
      return { success: true, viewer };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Database: Get Viewer by ID
  ipcMain.handle('db:get-viewer', async (event, id: string) => {
    try {
      const viewer = viewersRepo.getById(id);
      return { success: true, viewer };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Database: Get All Viewers
  ipcMain.handle('db:get-all-viewers', async (event, limit?: number, offset?: number) => {
    try {
      const viewers = viewersRepo.getAll(limit, offset);
      return { success: true, viewers };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Database: Search Viewers
  ipcMain.handle('db:search-viewers', async (event, query: string, limit?: number) => {
    try {
      const viewers = viewersRepo.search(query, limit);
      return { success: true, viewers };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Database: Delete Viewer
  ipcMain.handle('db:delete-viewer', async (event, id: string) => {
    try {
      viewersRepo.delete(id);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Database: Delete All Viewers
  ipcMain.handle('db:delete-all-viewers', async () => {
    try {
      viewersRepo.deleteAll();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Database: Get Viewer Count
  ipcMain.handle('db:get-viewer-count', async () => {
    try {
      const count = viewersRepo.getCount();
      return { success: true, count };
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

  // IRC: Forward events to renderer AND store in database
  twitchIRCService.on('chat.join', async (event) => {
    mainWindow?.webContents.send('irc:chat-join', event);
    
    // Store JOIN event in database
    try {
      // Get current session to find channel_id
      const session = await sessionsRepo.getCurrentSession();
      if (session) {
        // Get or create viewer
        const viewer = await viewersRepo.getOrCreate(
          event.username, // Use username as ID for IRC users (no Twitch ID available)
          event.username,
          event.username  // Display name = username for IRC
        );
        
        // Store event
        const eventId = eventsRepo.storeEvent(
          'irc.chat.join',
          event,
          session.channel_id,
          viewer.id
        );
        
        console.log(`[IRC] JOIN event stored with ID: ${eventId}`);
        
        // Broadcast to renderer with viewer info
        mainWindow?.webContents.send('event:stored', {
          id: eventId,
          event_type: 'irc.chat.join',
          event_data: JSON.stringify(event),
          viewer_id: viewer.id,
          channel_id: session.channel_id,
          created_at: new Date().toISOString(),
          viewer_username: viewer.username,
          viewer_display_name: viewer.display_name
        });
      }
    } catch (error) {
      console.error('[IRC] Failed to store JOIN event:', error);
    }
  });

  twitchIRCService.on('chat.part', async (event) => {
    mainWindow?.webContents.send('irc:chat-part', event);
    
    // Store PART event in database
    try {
      // Get current session to find channel_id
      const session = await sessionsRepo.getCurrentSession();
      if (session) {
        // Get or create viewer
        const viewer = await viewersRepo.getOrCreate(
          event.username, // Use username as ID for IRC users (no Twitch ID available)
          event.username,
          event.username  // Display name = username for IRC
        );
        
        // Store event
        const eventId = eventsRepo.storeEvent(
          'irc.chat.part',
          event,
          session.channel_id,
          viewer.id
        );
        
        console.log(`[IRC] PART event stored with ID: ${eventId}`);
        
        // Broadcast to renderer with viewer info
        mainWindow?.webContents.send('event:stored', {
          id: eventId,
          event_type: 'irc.chat.part',
          event_data: JSON.stringify(event),
          viewer_id: viewer.id,
          channel_id: session.channel_id,
          created_at: new Date().toISOString(),
          viewer_username: viewer.username,
          viewer_display_name: viewer.display_name
        });
      }
    } catch (error) {
      console.error('[IRC] Failed to store PART event:', error);
    }
  });

  twitchIRCService.on('status', (status) => {
    mainWindow?.webContents.send('irc:status', status);
  });

  // TTS Handlers
  ipcMain.handle('tts:get-voices', async () => {
    try {
      const manager = await initializeTTS();
      const settings = manager.getSettings();
      
      // Web Speech API is handled in renderer process
      if (settings?.provider === 'webspeech') {
        return { success: true, voices: [] };
      }
      
      const voices = await manager.getVoices();
      return { success: true, voices };
    } catch (error: any) {
      console.error('[TTS] Error getting voices:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('tts:test-voice', async (event, voiceId: string, options?: any) => {
    try {
      const manager = await initializeTTS();
      const settings = manager.getSettings();
      
      // Web Speech API is handled in renderer process
      if (settings?.provider === 'webspeech') {
        return { success: true };
      }
      
      await manager.testVoice(voiceId, options);
      return { success: true };
    } catch (error: any) {
      console.error('[TTS] Error testing voice:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('tts:speak', async (event, text: string, options?: any) => {
    try {
      const manager = await initializeTTS();
      const settings = manager.getSettings();
      
      // Web Speech API is handled in renderer process
      if (settings?.provider === 'webspeech') {
        return { success: true };
      }
      
      await manager.speak(text, options);
      return { success: true };
    } catch (error: any) {
      console.error('[TTS] Error speaking:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('tts:stop', async () => {
    try {
      const manager = await initializeTTS();
      const settings = manager.getSettings();
      
      // Web Speech API is handled in renderer process
      if (settings?.provider === 'webspeech') {
        return { success: true };
      }
      
      manager.stop();
      return { success: true };
    } catch (error: any) {
      console.error('[TTS] Error stopping:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('tts:get-settings', async () => {
    try {
      const manager = await initializeTTS();
      const settings = manager.getSettings();
      return { success: true, settings };
    } catch (error: any) {
      console.error('[TTS] Error getting settings:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('tts:save-settings', async (event, settings: any) => {
    try {
      const manager = await initializeTTS();
      await manager.saveSettings(settings);
      return { success: true };
    } catch (error: any) {
      console.error('[TTS] Error saving settings:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('tts:get-providers', async () => {
    try {
      const manager = await initializeTTS();
      const providers = manager.getProviderNames();
      return { success: true, providers };
    } catch (error: any) {
      console.error('[TTS] Error getting providers:', error);
      return { success: false, error: error.message };
    }
  });
}
