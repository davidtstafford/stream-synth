/**
 * Database IPC Handlers
 * 
 * Handles all database operations via IPC using centralized IPC Framework:
 * - Settings
 * - Sessions
 * - Event Subscriptions
 * - OAuth Tokens
 * - Viewers
 * - Events
 * - Subscriptions
 * 
 * Phase 3: Migrated to use IPCRegistry for consistent error handling
 */

import { ipcMain } from 'electron';
import { ipcRegistry } from '../ipc/ipc-framework';
import { SettingsRepository } from '../../database/repositories/settings';
import { SessionsRepository } from '../../database/repositories/sessions';
import { EventsRepository } from '../../database/repositories/events';
import { TokensRepository } from '../../database/repositories/tokens';
import { ViewersRepository } from '../../database/repositories/viewers';
import { SubscriptionsRepository } from '../../database/repositories/subscriptions';
import { TwitchSubscriptionsService } from '../../services/twitch-subscriptions';

// Initialize repositories
const settingsRepo = new SettingsRepository();
const sessionsRepo = new SessionsRepository();
const eventsRepo = new EventsRepository();
const tokensRepo = new TokensRepository();
const viewersRepo = new ViewersRepository();
const subscriptionsRepo = new SubscriptionsRepository();
const twitchSubsService = new TwitchSubscriptionsService();

export function setupDatabaseHandlers(): void {
  // ===== Database: Settings =====
  ipcRegistry.register<string, string | null>(
    'db:get-setting',
    {
      validate: (key) => key ? null : 'Setting key is required',
      execute: async (key) => settingsRepo.get(key)
    }
  );

  ipcRegistry.register<{ key: string; value: string }, { success: boolean }>(
    'db:set-setting',
    {
      validate: (input) => {
        if (!input.key) return 'Setting key is required';
        if (input.value === undefined || input.value === null) return 'Setting value is required';
        return null;
      },
      execute: async (input) => {
        settingsRepo.set(input.key, input.value);
        return { success: true };
      }
    }
  );
  ipcRegistry.register<void, any[]>(
    'db:get-all-settings',
    {
      execute: async () => settingsRepo.getAll()
    }
  );

  // ===== Database: Sessions =====
  ipcRegistry.register<any, { success: boolean; id: number }>(
    'db:create-session',
    {
      validate: (session) => {
        if (!session) return 'Session data is required';
        if (!session.user_id) return 'User ID is required';
        return null;
      },
      execute: async (session) => {
        const id = sessionsRepo.create(session);
        return { success: true, id };
      }
    }
  );

  ipcRegistry.register<void, any>(
    'db:get-current-session',
    {
      execute: async () => sessionsRepo.getCurrentSession()
    }
  );

  ipcRegistry.register<void, { success: boolean }>(
    'db:end-current-session',
    {
      execute: async () => {
        sessionsRepo.endCurrentSession();
        return { success: true };
      }
    }
  );

  ipcRegistry.register<number, any[]>(
    'db:get-recent-sessions',
    {
      execute: async (limit = 10) => sessionsRepo.getRecentSessions(limit)
    }
  );

  // ===== Database: Event Subscriptions =====
  ipcRegistry.register<{ userId: string; channelId: string; eventType: string; isEnabled: boolean }, { success: boolean }>(
    'db:save-subscription',
    {
      validate: (input) => {
        if (!input.userId) return 'User ID is required';
        if (!input.channelId) return 'Channel ID is required';
        if (!input.eventType) return 'Event type is required';
        return null;
      },
      execute: async (input) => {
        eventsRepo.saveSubscription(input.userId, input.channelId, input.eventType, input.isEnabled);
        return { success: true };
      }
    }
  );

  ipcRegistry.register<{ userId: string; channelId: string }, any[]>(
    'db:get-subscriptions',
    {
      validate: (input) => {
        if (!input.userId) return 'User ID is required';
        if (!input.channelId) return 'Channel ID is required';
        return null;
      },
      execute: async (input) => eventsRepo.getSubscriptions(input.userId, input.channelId)
    }
  );

  ipcRegistry.register<{ userId: string; channelId: string }, string[]>(
    'db:get-enabled-events',
    {
      validate: (input) => {
        if (!input.userId) return 'User ID is required';
        if (!input.channelId) return 'Channel ID is required';
        return null;
      },
      execute: async (input) => eventsRepo.getEnabledEvents(input.userId, input.channelId)
    }
  );

  ipcRegistry.register<{ userId: string; channelId: string }, { success: boolean }>(
    'db:clear-subscriptions',
    {
      validate: (input) => {
        if (!input.userId) return 'User ID is required';
        if (!input.channelId) return 'Channel ID is required';
        return null;
      },
      execute: async (input) => {
        eventsRepo.clearSubscriptions(input.userId, input.channelId);
        return { success: true };
      }
    }
  );

  // ===== Database: OAuth Tokens =====
  ipcRegistry.register<any, { success: boolean }>(
    'db:save-token',
    {
      validate: (token) => {
        if (!token) return 'Token data is required';
        if (!token.userId) return 'User ID is required';
        return null;
      },
      execute: async (token) => {
        tokensRepo.save(token);
        return { success: true };
      }
    }
  );

  ipcRegistry.register<string, any>(
    'db:get-token',
    {
      validate: (userId) => userId ? null : 'User ID is required',
      execute: async (userId) => tokensRepo.get(userId)
    }
  );

  ipcRegistry.register<string, { success: boolean }>(
    'db:invalidate-token',
    {
      validate: (userId) => userId ? null : 'User ID is required',
      execute: async (userId) => {
        tokensRepo.invalidate(userId);
        return { success: true };
      }
    }
  );

  ipcRegistry.register<string, { success: boolean }>(
    'db:delete-token',
    {
      validate: (userId) => userId ? null : 'User ID is required',
      execute: async (userId) => {
        tokensRepo.delete(userId);
        return { success: true };
      }
    }
  );
  // ===== Database: Viewers =====
  ipcRegistry.register<{ id: string; username: string; displayName?: string }, { success: boolean; viewer: any }>(
    'db:get-or-create-viewer',
    {
      validate: (input) => {
        if (!input.id) return 'Viewer ID is required';
        if (!input.username) return 'Username is required';
        return null;
      },
      execute: async (input) => {
        const viewer = viewersRepo.getOrCreate(input.id, input.username, input.displayName);
        if (!viewer) {
          throw new Error('Viewer not created: numeric ID required');
        }
        return { success: true, viewer };
      }
    }
  );

  ipcRegistry.register<string, { success: boolean; viewer: any }>(
    'db:get-viewer',
    {
      validate: (id) => id ? null : 'Viewer ID is required',
      execute: async (id) => {
        const viewer = viewersRepo.getViewerById(id);
        return { success: true, viewer };
      }
    }
  );

  ipcRegistry.register<{ limit?: number; offset?: number }, { success: boolean; viewers: any[] }>(
    'db:get-all-viewers',
    {
      execute: async (input) => {
        const viewers = viewersRepo.getAllViewers(input.limit, input.offset);
        return { success: true, viewers };
      }
    }
  );

  ipcRegistry.register<{ query: string; limit?: number }, { success: boolean; viewers: any[] }>(
    'db:search-viewers',
    {
      validate: (input) => input.query ? null : 'Search query is required',
      execute: async (input) => {
        const viewers = viewersRepo.search(input.query, input.limit);
        return { success: true, viewers };
      }
    }
  );

  ipcRegistry.register<string, { success: boolean }>(
    'db:delete-viewer',
    {
      validate: (id) => id ? null : 'Viewer ID is required',
      execute: async (id) => {
        viewersRepo.deleteViewer(id);
        return { success: true };
      }
    }
  );

  ipcRegistry.register<void, { success: boolean }>(
    'db:delete-all-viewers',
    {
      execute: async () => {
        viewersRepo.deleteAllViewers();
        return { success: true };
      }
    }
  );

  ipcRegistry.register<void, { success: boolean; count: number }>(
    'db:get-viewer-count',
    {
      execute: async () => {
        const count = viewersRepo.getCount();
        return { success: true, count };
      }
    }
  );
  // ===== Database: Events =====
  ipcRegistry.register<any, { success: boolean; events: any[] }>(
    'db:get-events',
    {
      execute: async (filters) => {
        const events = eventsRepo.getEvents(filters);
        return { success: true, events };
      }
    }
  );

  ipcRegistry.register<{ channelId: string; limit?: number }, { success: boolean; events: any[] }>(
    'db:get-chat-events',
    {
      validate: (input) => input.channelId ? null : 'Channel ID is required',
      execute: async (input) => {
        const events = eventsRepo.getChatEvents(input.channelId, input.limit);
        return { success: true, events };
      }
    }
  );

  ipcRegistry.register<{ channelId?: string; eventType?: string }, { success: boolean; count: number }>(
    'db:get-event-count',
    {
      execute: async (input) => {
        const count = eventsRepo.getEventCount(input.channelId, input.eventType);
        return { success: true, count };
      }
    }
  );

  // ===== Database: Subscriptions =====
  ipcRegistry.register<any, { success: boolean }>(
    'db:upsert-subscription',
    {
      validate: (subscription) => subscription ? null : 'Subscription data is required',
      execute: async (subscription) => {
        subscriptionsRepo.upsert(subscription);
        return { success: true };
      }
    }
  );

  ipcRegistry.register<string, { success: boolean; subscription: any }>(
    'db:get-subscription',
    {
      validate: (viewerId) => viewerId ? null : 'Viewer ID is required',
      execute: async (viewerId) => {
        const subscription = subscriptionsRepo.getByViewerId(viewerId);
        return { success: true, subscription };
      }
    }
  );
  ipcRegistry.register<{ limit?: number; offset?: number }, any[]>(
    'db:get-all-viewers-with-status',
    {
      execute: async (input) => {
        return subscriptionsRepo.getAllViewersWithStatus(input.limit, input.offset);
      }
    }
  );

  ipcRegistry.register<{ query: string; limit?: number }, any[]>(
    'db:search-viewers-with-status',
    {
      validate: (input) => input.query ? null : 'Search query is required',
      execute: async (input) => {
        return subscriptionsRepo.searchViewersWithStatus(input.query, input.limit);
      }
    }
  );

  ipcRegistry.register<string, { success: boolean }>(
    'db:delete-subscription',
    {
      validate: (viewerId) => viewerId ? null : 'Viewer ID is required',
      execute: async (viewerId) => {
        subscriptionsRepo.deleteByViewerId(viewerId);
        return { success: true };
      }
    }
  );

  ipcRegistry.register<{ broadcasterId: string; userId: string }, any>(
    'db:sync-subscriptions',
    {
      validate: (input) => {
        if (!input.broadcasterId) return 'Broadcaster ID is required';
        if (!input.userId) return 'User ID is required';
        return null;
      },
      execute: async (input) => {
        return await twitchSubsService.syncSubscriptionsFromTwitch(input.broadcasterId, input.userId);
      }
    }
  );

  ipcRegistry.register<string, any>(
    'db:check-subscription-status',
    {
      validate: (viewerId) => viewerId ? null : 'Viewer ID is required',
      execute: async (viewerId) => {
        const result = await twitchSubsService.checkSubscriptionStatus(viewerId);
        return { success: true, ...result };
      }
    }
  );

  }

export { settingsRepo, sessionsRepo, eventsRepo, tokensRepo, viewersRepo, subscriptionsRepo };

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
      };      // Add viewer info if available
      if (viewerId) {
        const viewer = viewersRepo.getViewerById(viewerId);
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
