/**
 * Database IPC Handlers
 * 
 * Handles all database operations via IPC:
 * - Settings
 * - Sessions
 * - Event Subscriptions
 * - OAuth Tokens
 * - Viewers
 * - Events
 */

import { ipcMain } from 'electron';
import { SettingsRepository } from '../../database/repositories/settings';
import { SessionsRepository } from '../../database/repositories/sessions';
import { EventsRepository } from '../../database/repositories/events';
import { TokensRepository } from '../../database/repositories/tokens';
import { ViewersRepository } from '../../database/repositories/viewers';

// Initialize repositories
const settingsRepo = new SettingsRepository();
const sessionsRepo = new SessionsRepository();
const eventsRepo = new EventsRepository();
const tokensRepo = new TokensRepository();
const viewersRepo = new ViewersRepository();

export function setupDatabaseHandlers(): void {
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

  // Database: Viewers - Get or Create
  ipcMain.handle('db:get-or-create-viewer', async (event, id: string, username: string, displayName?: string) => {
    try {
      const viewer = viewersRepo.getOrCreate(id, username, displayName);
      if (!viewer) {
        return { success: false, error: 'Viewer not created: numeric ID required' };
      }
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
}

export { settingsRepo, sessionsRepo, eventsRepo, tokensRepo, viewersRepo };

// Database: Store Event (special handler that also forwards to TTS)
// This needs to be defined here because it needs access to the TTS manager
export function setupEventStorageHandler(ttsInitializer: () => Promise<any>, mainWindow: any): void {
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

      // Forward EventSub chat messages to TTS manager so they are enqueued for speaking.
      // IRC chat is intentionally ignored elsewhere; only EventSub `channel.chat.message` should trigger TTS.
      try {
        if (eventType === 'channel.chat.message') {
          const payload = typeof eventData === 'string' ? JSON.parse(eventData) : eventData;
          const chatText = payload?.message?.text || payload?.message || '';
          const username = (storedEvent as any).viewer_username || payload?.chatter_user_login || 'Unknown';
          const viewerIdForTts = (storedEvent as any).viewer_id || viewerId;

          console.log('[EventSub→TTS] Forwarding chat to TTS:', username, '-', chatText);

          // Initialize and invoke TTS manager in background (don't block response)
          ttsInitializer()
            .then(manager => {
              if (manager) {
                try {
                  manager.handleChatMessage(username, chatText, viewerIdForTts);
                } catch (err) {
                  console.warn('[TTS] Failed to handle chat message:', err);
                }
              }
            })
            .catch(err => {
              console.warn('[TTS] Failed to initialize manager for chat forwarding:', err);
            });
        }
      } catch (err) {
        console.warn('[TTS] Error while attempting to forward stored event to TTS:', err);
      }

      return { success: true, id };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
