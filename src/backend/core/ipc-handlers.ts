import { ipcMain, BrowserWindow } from 'electron';
import { authenticateWithTwitch } from '../auth/twitch-oauth';
import { SettingsRepository } from '../database/repositories/settings';
import { SessionsRepository } from '../database/repositories/sessions';
import { EventsRepository } from '../database/repositories/events';
import { TokensRepository } from '../database/repositories/tokens';
import { ViewersRepository } from '../database/repositories/viewers';
import { VoicesRepository } from '../database/repositories/voices';
import { ViewerRulesRepository } from '../database/viewer-rules-repository';
import { exportSettings, importSettings, getExportPreview } from '../services/export-import';
import { twitchIRCService } from '../services/twitch-irc';
import { TTSManager } from '../services/tts/manager';
import { VoiceSyncService } from '../services/tts/voice-sync';
import { getDatabase } from '../database/connection';

let mainWindow: BrowserWindow | null = null;

// Initialize repositories
const settingsRepo = new SettingsRepository();
const sessionsRepo = new SessionsRepository();
const eventsRepo = new EventsRepository();
const tokensRepo = new TokensRepository();
const viewersRepo = new ViewersRepository();
const voicesRepo = new VoicesRepository();

// Initialize viewer rules repository
let viewerRulesRepo: ViewerRulesRepository | null = null;
function getViewerRulesRepo(): ViewerRulesRepository {
  if (!viewerRulesRepo) {
    const db = getDatabase();
    viewerRulesRepo = new ViewerRulesRepository(db);
  }
  return viewerRulesRepo;
}

// Initialize TTS Manager
let ttsManager: TTSManager | null = null;
let voiceSyncService: VoiceSyncService | null = null;

async function initializeTTS() {
  if (!ttsManager) {
    const db = getDatabase();
    ttsManager = new TTSManager(db);
    await ttsManager.initialize();
    
    // Set main window for TTS manager
    if (mainWindow) {
      ttsManager.setMainWindow(mainWindow);
    }
  }
  if (!voiceSyncService) {
    voiceSyncService = new VoiceSyncService(voicesRepo);
  }
  return ttsManager;
}

export function setMainWindow(window: BrowserWindow): void {
  mainWindow = window;
  
  // Also set on TTS manager if it's initialized
  if (ttsManager) {
    ttsManager.setMainWindow(window);
  }
}

export async function runStartupTasks(): Promise<void> {
  try {
    console.log('[Startup] Running startup tasks...');
    
    // Check if Discord auto-post is enabled
    const discordSettingsStr = settingsRepo.get('discord_settings');
    if (!discordSettingsStr) {
      console.log('[Startup] No Discord settings found, skipping auto-post');
      return;
    }
    
    const discordSettings = JSON.parse(discordSettingsStr);
    if (!discordSettings.autoPostOnStartup || !discordSettings.webhookUrl) {
      console.log('[Startup] Discord auto-post not enabled or no webhook URL');
      return;
    }
    
    console.log('[Startup] Discord auto-post enabled, updating voice catalogue...');
    
    // Wait a moment for everything to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Extract webhook ID and token from URL
    const urlMatch = discordSettings.webhookUrl.match(/webhooks\/(\d+)\/([^\/]+)/);
    if (!urlMatch) {
      console.error('[Startup] Invalid webhook URL format');
      return;
    }
    
    const [, webhookId, webhookToken] = urlMatch;
    console.log('[Startup] Webhook ID:', webhookId);
    
    // Delete old message if we have the ID stored
    if (discordSettings.lastMessageId) {
      try {
        console.log('[Startup] Deleting previous message:', discordSettings.lastMessageId);
        const deleteUrl = `https://discord.com/api/v10/webhooks/${webhookId}/${webhookToken}/messages/${discordSettings.lastMessageId}`;
        const deleteResponse = await fetch(deleteUrl, { method: 'DELETE' });
        
        if (deleteResponse.ok || deleteResponse.status === 404) {
          console.log('[Startup] Successfully deleted previous message');
        } else {
          console.error('[Startup] Failed to delete message:', deleteResponse.status);
        }
      } catch (err: any) {
        console.error('[Startup] Error deleting previous message:', err.message);
      }
      
      // Wait a bit after deletion
      await new Promise(resolve => setTimeout(resolve, 500));
    } else {
      console.log('[Startup] No previous message ID stored, skipping deletion');
    }
    
    // Wait before posting
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Post new catalogue
    const grouped = voicesRepo.getGroupedVoices();
    const stats = voicesRepo.getStats();
    
    const fields: any[] = [];
    const groupKeys = Array.from(grouped.keys()).sort();
    
    for (const groupKey of groupKeys) {
      const voices = grouped.get(groupKey);
      if (!voices || voices.length === 0) continue;

      let value = '';
      const sortedVoices = voices.sort((a, b) => a.numeric_id - b.numeric_id);
      
      for (const voice of sortedVoices) {
        const gender = voice.gender === 'male' ? '♂️' : voice.gender === 'female' ? '♀️' : '⚧';
        const idStr = String(voice.numeric_id).padStart(3, '0');
        const line = `\`${idStr}\` │ ${voice.name} ${gender}\n`;
        
        if (value.length + line.length > 1020) {
          if (value.length > 0) {
            const existingParts = fields.filter(f => f.name.startsWith(groupKey));
            const partNum = existingParts.length + 1;
            fields.push({
              name: `${groupKey} (Part ${partNum})`,
              value: value.trim(),
              inline: false
            });
            value = '';
          }
        }
        
        value += line;
      }

      if (value.length > 0) {
        const existingParts = fields.filter(f => f.name.startsWith(groupKey));
        const fieldName = existingParts.length > 0 ? `${groupKey} (Part ${existingParts.length + 1})` : groupKey;
        fields.push({
          name: fieldName,
          value: value.trim(),
          inline: false
        });
      }

      if (fields.length >= 25) break;
    }

    const embed = {
      title: '🎤 TTS Voice Catalogue',
      description: `**${stats.available} voices available**\n\nUse \`~setmyvoice <ID>\` to select your voice\nExample: \`~setmyvoice 22\` for Eddy`,
      color: 0x5865F2,
      fields: fields,
      footer: {
        text: 'Stream Synth • Voice IDs are permanent • Auto-updated on startup'
      },
      timestamp: new Date().toISOString()
    };

    // Add ?wait=true to get the message data in response
    const webhookUrlWithWait = discordSettings.webhookUrl + '?wait=true';
    
    const response = await fetch(webhookUrlWithWait, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ embeds: [embed] })
    });

    if (response.ok) {
      const messageData = await response.json();
      console.log('[Startup] Posted message ID:', messageData.id);
      
      // Save the message ID for future deletion
      discordSettings.lastMessageId = messageData.id;
      settingsRepo.set('discord_settings', JSON.stringify(discordSettings));
      console.log('[Startup] Saved message ID for future deletion');
    } else {
      console.error('[Startup] Failed to post message:', response.status);
    }

    console.log('[Startup] Discord voice catalogue auto-posted successfully');
  } catch (error: any) {
    console.error('[Startup] Error in startup tasks:', error);
  }
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

  // TTS Chat Message Handler
  twitchIRCService.on('chat.message', async (event: any) => {
    try {
      // Initialize TTS if needed
      const manager = await initializeTTS();
      
      // Handle the message
      await manager.handleChatMessage(event.username, event.message, event.userId);
    } catch (error) {
      console.error('[TTS] Error handling chat message:', error);
    }
  });

  // TTS Handlers (legacy handlers for Azure/Google providers)
  // Note: tts:get-voices is now handled by the voice categorization system below
  
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

  // TTS Voice Management
  ipcMain.handle('tts:sync-voices', async (event, provider: string, voices: any[]) => {
    try {
      await initializeTTS(); // Ensure services are initialized
      console.log(`[TTS] Syncing voices for provider: ${provider}, count: ${voices.length}`);
      let count = 0;
      
      if (provider === 'webspeech' && voiceSyncService) {
        count = await voiceSyncService.syncWebSpeechVoices(voices);
      }
      
      const stats = voiceSyncService?.getStats();
      console.log(`[TTS] Voice sync complete. Stats:`, stats);
      
      return { success: true, count, stats };
    } catch (error: any) {
      console.error('[TTS] Error syncing voices:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('tts:get-voices', async () => {
    try {
      const voices = voicesRepo.getAvailableVoices();
      return { success: true, voices };
    } catch (error: any) {
      console.error('[TTS] Error getting voices:', error);
      return { success: false, error: error.message, voices: [] };
    }
  });

  ipcMain.handle('tts:get-grouped-voices', async () => {
    try {
      const grouped = voicesRepo.getGroupedVoices();
      const result: Record<string, any[]> = {};
      
      grouped.forEach((voices, key) => {
        result[key] = voices;
      });
      
      return { success: true, grouped: result };
    } catch (error: any) {
      console.error('[TTS] Error getting grouped voices:', error);
      return { success: false, error: error.message, grouped: {} };
    }
  });

  ipcMain.handle('tts:get-voice-stats', async () => {
    try {
      const stats = voicesRepo.getStats();
      return { success: true, stats };
    } catch (error: any) {
      console.error('[TTS] Error getting voice stats:', error);
      return { success: false, error: error.message, stats: null };
    }
  });

  ipcMain.handle('tts:get-voice-by-id', async (event, numericId: number) => {
    try {
      const voice = voicesRepo.getVoiceByNumericId(numericId);
      return { success: true, voice };
    } catch (error: any) {
      console.error('[TTS] Error getting voice by ID:', error);
      return { success: false, error: error.message, voice: null };
    }
  });

  // Viewer TTS Rules Handlers
  ipcMain.handle('viewer-rules:get', async (event, username: string) => {
    try {
      const repo = getViewerRulesRepo();
      const rule = repo.getByUsername(username);
      return { success: true, rule };
    } catch (error: any) {
      console.error('[ViewerRules] Error getting rule:', error);
      return { success: false, error: error.message, rule: null };
    }
  });

  ipcMain.handle('viewer-rules:create', async (event, input: any) => {
    try {
      const repo = getViewerRulesRepo();
      const rule = repo.create(input);
      return { success: true, rule };
    } catch (error: any) {
      console.error('[ViewerRules] Error creating rule:', error);
      return { success: false, error: error.message, rule: null };
    }
  });

  ipcMain.handle('viewer-rules:update', async (event, username: string, updates: any) => {
    try {
      const repo = getViewerRulesRepo();
      const rule = repo.update(username, updates);
      if (!rule) {
        return { success: false, error: 'Rule not found', rule: null };
      }
      return { success: true, rule };
    } catch (error: any) {
      console.error('[ViewerRules] Error updating rule:', error);
      return { success: false, error: error.message, rule: null };
    }
  });

  ipcMain.handle('viewer-rules:delete', async (event, username: string) => {
    try {
      const repo = getViewerRulesRepo();
      const deleted = repo.delete(username);
      return { success: deleted };
    } catch (error: any) {
      console.error('[ViewerRules] Error deleting rule:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('viewer-rules:get-all', async () => {
    try {
      const repo = getViewerRulesRepo();
      const rules = repo.getAll();
      return { success: true, rules };
    } catch (error: any) {
      console.error('[ViewerRules] Error getting all rules:', error);
      return { success: false, error: error.message, rules: [] };
    }
  });

  // Discord Webhook Handlers
  ipcMain.handle('discord:test-webhook', async (event, webhookUrl: string) => {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: '✅ **Stream Synth Test** - Webhook connection successful!'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Discord API error: ${response.status} ${errorText}`);
      }

      return { success: true };
    } catch (error: any) {
      console.error('[Discord] Error testing webhook:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('discord:generate-voice-catalogue', async () => {
    try {
      const grouped = voicesRepo.getGroupedVoices();
      const stats = voicesRepo.getStats();
      
      let catalogue = `**🎤 TTS Voice Catalogue** (${stats.available} voices available)\n\n`;
      catalogue += `Use the command: \`~setmyvoice <ID>\` to select your voice\n`;
      catalogue += `Example: \`~setmyvoice 22\` for Eddy\n\n`;

      // Sort group keys for consistent ordering
      const groupKeys = Array.from(grouped.keys()).sort();
      
      for (const groupKey of groupKeys) {
        const voices = grouped.get(groupKey);
        if (!voices || voices.length === 0) continue;

        catalogue += `**${groupKey}**\n`;
        
        // Sort voices by numeric ID
        const sortedVoices = voices.sort((a, b) => a.numeric_id - b.numeric_id);
        
        for (const voice of sortedVoices) {
          const gender = voice.gender === 'male' ? '♂️' : voice.gender === 'female' ? '♀️' : '⚧';
          const idStr = String(voice.numeric_id).padStart(3, '0');
          catalogue += `\`${idStr}\` │ ${voice.name} ${gender}\n`;
        }
        
        catalogue += '\n';
      }

      return { success: true, catalogue };
    } catch (error: any) {
      console.error('[Discord] Error generating voice catalogue:', error);
      return { success: false, error: error.message, catalogue: '' };
    }
  });

  ipcMain.handle('discord:post-voice-catalogue', async (event, webhookUrl: string) => {
    try {
      console.log('[Discord] Starting voice catalogue post to:', webhookUrl);
      
      const grouped = voicesRepo.getGroupedVoices();
      const stats = voicesRepo.getStats();
      
      console.log('[Discord] Got', stats.total, 'voices in', grouped.size, 'groups');
      
      // Create embed fields for each language group
      const fields: any[] = [];
      const groupKeys = Array.from(grouped.keys()).sort();
      
      for (const groupKey of groupKeys) {
        const voices = grouped.get(groupKey);
        if (!voices || voices.length === 0) continue;

        // Group key format is: "Provider - Source - Language - Region" or "Provider - Language - Region"
        console.log('[Discord] Processing group:', groupKey);
        
        let value = '';
        const sortedVoices = voices.sort((a, b) => a.numeric_id - b.numeric_id);
        
        for (const voice of sortedVoices) {
          const gender = voice.gender === 'male' ? '♂️' : voice.gender === 'female' ? '♀️' : '⚧';
          const idStr = String(voice.numeric_id).padStart(3, '0');
          const line = `\`${idStr}\` │ ${voice.name} ${gender}\n`;
          
          // Discord field value limit is 1024 characters
          if (value.length + line.length > 1020) {
            // If this field is getting too long, add what we have and start a new field
            if (value.length > 0) {
              const existingParts = fields.filter(f => f.name.startsWith(groupKey));
              const partNum = existingParts.length + 1;
              fields.push({
                name: `${groupKey} (Part ${partNum})`,
                value: value.trim(),
                inline: false
              });
              value = '';
            }
          }
          
          value += line;
        }

        if (value.length > 0) {
          const existingParts = fields.filter(f => f.name.startsWith(groupKey));
          const fieldName = existingParts.length > 0 ? `${groupKey} (Part ${existingParts.length + 1})` : groupKey;
          fields.push({
            name: fieldName,
            value: value.trim(),
            inline: false
          });
        }

        // Discord has a 25 field limit per embed
        if (fields.length >= 25) {
          console.log('[Discord] Reached 25 field limit, stopping at', fields.length, 'fields');
          break;
        }
      }

      console.log('[Discord] Created', fields.length, 'embed fields');

      const embed = {
        title: '🎤 TTS Voice Catalogue',
        description: `**${stats.available} voices available**\n\nUse \`~setmyvoice <ID>\` to select your voice\nExample: \`~setmyvoice 22\` for Eddy`,
        color: 0x5865F2, // Discord blurple
        fields: fields,
        footer: {
          text: 'Stream Synth • Voice IDs are permanent'
        },
        timestamp: new Date().toISOString()
      };

      console.log('[Discord] Posting to webhook...');
      
      // Add ?wait=true to get the message data in response
      const webhookUrlWithWait = webhookUrl + '?wait=true';
      
      const response = await fetch(webhookUrlWithWait, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ embeds: [embed] })
      });

      console.log('[Discord] Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Discord] Error response:', errorText);
        throw new Error(`Discord API error: ${response.status} ${errorText}`);
      }

      // Get the message ID from the response and save it
      const messageData = await response.json();
      console.log('[Discord] Successfully posted voice catalogue, message ID:', messageData.id);
      
      // Save the message ID in settings for future deletion
      const discordSettingsStr = settingsRepo.get('discord_settings');
      if (discordSettingsStr) {
        const discordSettings = JSON.parse(discordSettingsStr);
        discordSettings.lastMessageId = messageData.id;
        settingsRepo.set('discord_settings', JSON.stringify(discordSettings));
        console.log('[Discord] Saved message ID for future deletion');
      }
      
      return { success: true, messageId: messageData.id };
    } catch (error: any) {
      console.error('[Discord] Error posting voice catalogue:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('discord:delete-webhook-messages', async (event, webhookUrl: string) => {
    try {
      console.log('[Discord] Deleting previous webhook messages...');
      
      // Extract webhook ID and token from URL
      // Format: https://discord.com/api/webhooks/{webhook.id}/{webhook.token}
      const urlMatch = webhookUrl.match(/webhooks\/(\d+)\/([^\/]+)/);
      if (!urlMatch) {
        throw new Error('Invalid webhook URL format');
      }
      
      const [, webhookId, webhookToken] = urlMatch;
      
      // Get all messages from this webhook (limited to last 100)
      const messagesUrl = `https://discord.com/api/v10/webhooks/${webhookId}/${webhookToken}/messages`;
      const messagesResponse = await fetch(messagesUrl);
      
      if (!messagesResponse.ok) {
        const errorText = await messagesResponse.text();
        console.error('[Discord] Error fetching messages:', errorText);
        throw new Error(`Failed to fetch messages: ${messagesResponse.status}`);
      }
      
      const messages = await messagesResponse.json();
      console.log('[Discord] Found', messages.length, 'messages to delete');
      
      // Delete each message
      let deletedCount = 0;
      for (const message of messages) {
        try {
          const deleteUrl = `https://discord.com/api/v10/webhooks/${webhookId}/${webhookToken}/messages/${message.id}`;
          const deleteResponse = await fetch(deleteUrl, {
            method: 'DELETE'
          });
          
          if (deleteResponse.ok || deleteResponse.status === 404) {
            deletedCount++;
            console.log('[Discord] Deleted message', message.id);
          } else {
            console.error('[Discord] Failed to delete message', message.id, ':', deleteResponse.status);
          }
          
          // Rate limiting: wait a bit between deletions
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err: any) {
          console.error('[Discord] Error deleting message', message.id, ':', err.message);
        }
      }
      
      console.log('[Discord] Deleted', deletedCount, 'of', messages.length, 'messages');
      return { success: true, deletedCount, totalMessages: messages.length };
    } catch (error: any) {
      console.error('[Discord] Error deleting webhook messages:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('discord:auto-update-catalogue', async (event, webhookUrl: string) => {
    try {
      console.log('[Discord] Auto-updating voice catalogue...');
      
      // Step 1: Delete previous messages
      const deleteResult = await ipcMain.emit('discord:delete-webhook-messages', event, webhookUrl);
      console.log('[Discord] Deletion step completed');
      
      // Wait a moment for Discord API
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 2: Post new catalogue
      console.log('[Discord] Posting updated catalogue...');
      const grouped = voicesRepo.getGroupedVoices();
      const stats = voicesRepo.getStats();
      
      const fields: any[] = [];
      const groupKeys = Array.from(grouped.keys()).sort();
      
      for (const groupKey of groupKeys) {
        const voices = grouped.get(groupKey);
        if (!voices || voices.length === 0) continue;

        let value = '';
        const sortedVoices = voices.sort((a, b) => a.numeric_id - b.numeric_id);
        
        for (const voice of sortedVoices) {
          const gender = voice.gender === 'male' ? '♂️' : voice.gender === 'female' ? '♀️' : '⚧';
          const idStr = String(voice.numeric_id).padStart(3, '0');
          const line = `\`${idStr}\` │ ${voice.name} ${gender}\n`;
          
          if (value.length + line.length > 1020) {
            if (value.length > 0) {
              const existingParts = fields.filter(f => f.name.startsWith(groupKey));
              const partNum = existingParts.length + 1;
              fields.push({
                name: `${groupKey} (Part ${partNum})`,
                value: value.trim(),
                inline: false
              });
              value = '';
            }
          }
          
          value += line;
        }

        if (value.length > 0) {
          const existingParts = fields.filter(f => f.name.startsWith(groupKey));
          const fieldName = existingParts.length > 0 ? `${groupKey} (Part ${existingParts.length + 1})` : groupKey;
          fields.push({
            name: fieldName,
            value: value.trim(),
            inline: false
          });
        }

        if (fields.length >= 25) break;
      }

      const embed = {
        title: '🎤 TTS Voice Catalogue',
        description: `**${stats.available} voices available**\n\nUse \`~setmyvoice <ID>\` to select your voice\nExample: \`~setmyvoice 22\` for Eddy`,
        color: 0x5865F2,
        fields: fields,
        footer: {
          text: 'Stream Synth • Voice IDs are permanent • Auto-updated'
        },
        timestamp: new Date().toISOString()
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ embeds: [embed] })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Discord API error: ${response.status} ${errorText}`);
      }

      console.log('[Discord] Auto-update completed successfully');
      return { success: true };
    } catch (error: any) {
      console.error('[Discord] Error auto-updating catalogue:', error);
      return { success: false, error: error.message };
    }
  });
}
