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
import { TTSAccessRepository } from '../../database/repositories/tts-access';
import { ChannelPointGrantsRepository } from '../../database/repositories/channel-point-grants';
import { ViewerTTSRulesRepository } from '../../database/repositories/viewer-tts-rules';
import { ViewerHistoryRepository } from '../../database/repositories/viewer-history';
import { ViewerModerationActionsService } from '../../services/viewer-moderation-actions';

// Initialize repositories with lazy getters to avoid early initialization
let settingsRepoInstance: SettingsRepository | null = null;
const getSettingsRepo = () => settingsRepoInstance ??= new SettingsRepository();

let sessionsRepoInstance: SessionsRepository | null = null;
const getSessionsRepo = () => sessionsRepoInstance ??= new SessionsRepository();

let eventsRepoInstance: EventsRepository | null = null;
const getEventsRepo = () => eventsRepoInstance ??= new EventsRepository();

let tokensRepoInstance: TokensRepository | null = null;
const getTokensRepo = () => tokensRepoInstance ??= new TokensRepository();

let viewersRepoInstance: ViewersRepository | null = null;
const getViewersRepo = () => viewersRepoInstance ??= new ViewersRepository();

let subscriptionsRepoInstance: SubscriptionsRepository | null = null;
const getSubscriptionsRepo = () => subscriptionsRepoInstance ??= new SubscriptionsRepository();

let twitchSubsServiceInstance: TwitchSubscriptionsService | null = null;
const getTwitchSubsService = () => twitchSubsServiceInstance ??= new TwitchSubscriptionsService();

let ttsAccessRepoInstance: TTSAccessRepository | null = null;
const getTTSAccessRepo = () => ttsAccessRepoInstance ??= new TTSAccessRepository();

let channelPointGrantsRepoInstance: ChannelPointGrantsRepository | null = null;
const getChannelPointGrantsRepo = () => channelPointGrantsRepoInstance ??= new ChannelPointGrantsRepository();

let viewerTTSRulesRepoInstance: ViewerTTSRulesRepository | null = null;
const getViewerTTSRulesRepo = () => viewerTTSRulesRepoInstance ??= new ViewerTTSRulesRepository();

let viewerHistoryRepoInstance: ViewerHistoryRepository | null = null;
const getViewerHistoryRepo = () => viewerHistoryRepoInstance ??= new ViewerHistoryRepository();

let moderationActionsServiceInstance: ViewerModerationActionsService | null = null;
const getModerationActionsService = () => moderationActionsServiceInstance ??= new ViewerModerationActionsService();

export function setupDatabaseHandlers(): void {
  // ===== Database: Settings =====
  ipcRegistry.register<string, string | null>(
    'db:get-setting',
    {
      validate: (key) => key ? null : 'Setting key is required',
      execute: async (key) => getSettingsRepo().get(key)
    }
  );

  ipcRegistry.register<{ key: string; value: string }, { success: boolean }>(
    'db:set-setting',
    {
      validate: (input) => {
        if (!input.key) return 'Setting key is required';
        if (input.value === undefined || input.value === null) return 'Setting value is required';
        return null;
      },      execute: async (input) => {
        getSettingsRepo().set(input.key, input.value);
        return { success: true };
      }
    }
  );  ipcRegistry.register<void, any[]>(
    'db:get-all-settings',
    {
      execute: async () => getSettingsRepo().getAll()
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
        const id = getSessionsRepo().create(session);
        return { success: true, id };
      }
    }
  );

  ipcRegistry.register<void, any>(
    'db:get-current-session',
    {
      execute: async () => getSessionsRepo().getCurrentSession()
    }
  );

  ipcRegistry.register<void, { success: boolean }>(
    'db:end-current-session',
    {
      execute: async () => {
        getSessionsRepo().endCurrentSession();
        return { success: true };
      }
    }
  );

  ipcRegistry.register<number, any[]>(
    'db:get-recent-sessions',
    {
      execute: async (limit = 10) => getSessionsRepo().getRecentSessions(limit)
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
        getEventsRepo().saveSubscription(input.userId, input.channelId, input.eventType, input.isEnabled);
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
      execute: async (input) => getEventsRepo().getSubscriptions(input.userId, input.channelId)
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
      execute: async (input) => getEventsRepo().getEnabledEvents(input.userId, input.channelId)
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
        getEventsRepo().clearSubscriptions(input.userId, input.channelId);
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
        getTokensRepo().save(token);
        return { success: true };
      }
    }
  );

  ipcRegistry.register<string, any>(
    'db:get-token',
    {
      validate: (userId) => userId ? null : 'User ID is required',
      execute: async (userId) => getTokensRepo().get(userId)
    }
  );

  ipcRegistry.register<string, { success: boolean }>(
    'db:invalidate-token',
    {
      validate: (userId) => userId ? null : 'User ID is required',
      execute: async (userId) => {
        getTokensRepo().invalidate(userId);
        return { success: true };
      }
    }
  );

  ipcRegistry.register<string, { success: boolean }>(
    'db:delete-token',
    {
      validate: (userId) => userId ? null : 'User ID is required',
      execute: async (userId) => {
        getTokensRepo().delete(userId);
        return { success: true };
      }
    }
  );  // ===== Database: Viewers =====
  ipcRegistry.register<{ id: string; username: string; displayName?: string }, { success: boolean; viewer: any }>(
    'db:get-or-create-viewer',
    {
      validate: (input) => {
        if (!input.id) return 'Viewer ID is required';
        if (!input.username) return 'Username is required';
        return null;
      },
      execute: async (input) => {
        const viewer = getViewersRepo().getOrCreate(input.id, input.username, input.displayName);
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
        const viewer = getViewersRepo().getViewerById(id);
        return { success: true, viewer };
      }
    }
  );

  ipcRegistry.register<{ limit?: number; offset?: number }, { success: boolean; viewers: any[] }>(
    'db:get-all-viewers',
    {
      execute: async (input) => {
        const viewers = getViewersRepo().getAllViewers(input.limit, input.offset);
        return { success: true, viewers };
      }
    }
  );

  ipcRegistry.register<{ query: string; limit?: number }, { success: boolean; viewers: any[] }>(
    'db:search-viewers',
    {
      validate: (input) => input.query ? null : 'Search query is required',
      execute: async (input) => {
        const viewers = getViewersRepo().search(input.query, input.limit);
        return { success: true, viewers };
      }
    }
  );

  ipcRegistry.register<string, { success: boolean }>(
    'db:delete-viewer',
    {
      validate: (id) => id ? null : 'Viewer ID is required',
      execute: async (id) => {
        getViewersRepo().deleteViewer(id);
        return { success: true };
      }
    }
  );

  ipcRegistry.register<void, { success: boolean }>(
    'db:delete-all-viewers',
    {
      execute: async () => {
        getViewersRepo().deleteAllViewers();
        return { success: true };
      }
    }
  );

  ipcRegistry.register<void, { success: boolean; count: number }>(
    'db:get-viewer-count',
    {
      execute: async () => {
        const count = getViewersRepo().getCount();
        return { success: true, count };
      }
    }
  );
  // ===== Database: Events =====
  ipcRegistry.register<any, { success: boolean; events: any[] }>(
    'db:get-events',
    {
      execute: async (filters) => {
        const events = getEventsRepo().getEvents(filters);
        return { success: true, events };
      }
    }
  );

  ipcRegistry.register<{ channelId: string; limit?: number }, { success: boolean; events: any[] }>(
    'db:get-chat-events',
    {
      validate: (input) => input.channelId ? null : 'Channel ID is required',
      execute: async (input) => {
        const events = getEventsRepo().getChatEvents(input.channelId, input.limit);
        return { success: true, events };
      }
    }
  );

  ipcRegistry.register<{ channelId?: string; eventType?: string }, { success: boolean; count: number }>(
    'db:get-event-count',
    {
      execute: async (input) => {
        const count = getEventsRepo().getEventCount(input.channelId, input.eventType);
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
        getSubscriptionsRepo().upsert(subscription);
        return { success: true };
      }
    }
  );

  ipcRegistry.register<string, { success: boolean; subscription: any }>(
    'db:get-subscription',
    {
      validate: (viewerId) => viewerId ? null : 'Viewer ID is required',
      execute: async (viewerId) => {
        const subscription = getSubscriptionsRepo().getByViewerId(viewerId);
        return { success: true, subscription };
      }
    }
  );
  ipcRegistry.register<{ limit?: number; offset?: number }, any[]>(
    'db:get-all-viewers-with-status',
    {
      execute: async (input) => {
        return getSubscriptionsRepo().getAllViewersWithStatus(input.limit, input.offset);
      }
    }
  );

  ipcRegistry.register<{ query: string; limit?: number }, any[]>(
    'db:search-viewers-with-status',
    {
      validate: (input) => input.query ? null : 'Search query is required',
      execute: async (input) => {
        return getSubscriptionsRepo().searchViewersWithStatus(input.query, input.limit);
      }
    }
  );

  ipcRegistry.register<string, { success: boolean }>(
    'db:delete-subscription',
    {
      validate: (viewerId) => viewerId ? null : 'Viewer ID is required',
      execute: async (viewerId) => {
        getSubscriptionsRepo().deleteByViewerId(viewerId);
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
        return await getTwitchSubsService().syncSubscriptionsFromTwitch(input.broadcasterId, input.userId);
      }
    }
  );

  ipcRegistry.register<string, any>(
    'db:check-subscription-status',
    {
      validate: (viewerId) => viewerId ? null : 'Viewer ID is required',
      execute: async (viewerId) => {
        const result = await getTwitchSubsService().checkSubscriptionStatus(viewerId);
        return { success: true, ...result };
      }
    }
  );

  }

export { getSettingsRepo, getSessionsRepo, getEventsRepo, getTokensRepo, getViewersRepo, getSubscriptionsRepo };

// Database: Store Event (special handler that also forwards to TTS)
// This needs to be defined here because it needs access to the TTS manager
export function setupEventStorageHandler(ttsInitializer: () => Promise<any>, mainWindow: any): void {
  ipcMain.handle('db:store-event', async (event, eventType: string, eventData: any, channelId: string, viewerId?: string) => {
    try {
      const id = getEventsRepo().storeEvent(eventType, eventData, channelId, viewerId);

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
        const viewer = getViewersRepo().getViewerById(viewerId);
        if (viewer) {
          (storedEvent as any).viewer_username = viewer.username;
          (storedEvent as any).viewer_display_name = viewer.display_name;
        }
      }      mainWindow?.webContents.send('event:stored', storedEvent);

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
        }        // Handle channel point redemptions for TTS access grants
        if (eventType === 'channel.channel_points_custom_reward_redemption.add') {
          const payload = typeof eventData === 'string' ? JSON.parse(eventData) : eventData;
          const rewardTitle = payload?.reward?.title || '';
          const redeemerUserId = payload?.user_id || viewerId;
          
          if (!redeemerUserId) {
            console.warn('[Channel Points] Missing user_id for redemption');
            return { success: true, id };
          }

          // Get TTS access config to check if this redeem should grant access
          const config = getTTSAccessRepo().getConfig();
          
          // Check if this is a limited access grant redeem
          if (config.limited_redeem_name && rewardTitle === config.limited_redeem_name) {
            const durationMinutes = config.limited_redeem_duration_mins || 60;
            getChannelPointGrantsRepo().createGrant(
              redeemerUserId,
              'limited_access',
              rewardTitle,
              durationMinutes
            );
            
            console.log(`[Channel Points] Granted limited TTS access to user ${redeemerUserId} for ${durationMinutes} minutes via redeem "${rewardTitle}"`);
          }
          
          // Check if this is a premium voice access grant redeem
          if (config.premium_redeem_name && rewardTitle === config.premium_redeem_name) {
            const durationMinutes = config.premium_redeem_duration_mins || 60;
            getChannelPointGrantsRepo().createGrant(
              redeemerUserId,
              'premium_voice_access',
              rewardTitle,
              durationMinutes
            );
            
            console.log(`[Channel Points] Granted premium voice TTS access to user ${redeemerUserId} for ${durationMinutes} minutes via redeem "${rewardTitle}"`);
          }
        }
      } catch (err) {
        console.warn('[TTS] Error while attempting to forward stored event to TTS:', err);
      }      return { success: true, id };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
  // ===== Phase 4: Viewer TTS Rules (Mute & Cooldown) =====
  
  ipcRegistry.register<{ viewerId: string }, any>(
    'viewer-tts-rules:get',
    {
      validate: (input) => input?.viewerId ? null : 'Viewer ID is required',
      execute: async (input) => getViewerTTSRulesRepo().getByViewerId(input.viewerId)
    }
  );

  ipcRegistry.register<{ viewerId: string; mutePeriodMins?: number | null }, { success: boolean; error?: string }>(
    'viewer-tts-rules:set-mute',
    {
      validate: (input) => {
        if (!input?.viewerId) return 'Viewer ID is required';
        return null;
      },
      execute: async (input) => {
        return getViewerTTSRulesRepo().setMute(input.viewerId, {
          mute_period_mins: input.mutePeriodMins
        });
      }
    }
  );

  ipcRegistry.register<{ viewerId: string }, { success: boolean; error?: string }>(
    'viewer-tts-rules:remove-mute',
    {
      validate: (input) => input?.viewerId ? null : 'Viewer ID is required',
      execute: async (input) => getViewerTTSRulesRepo().removeMute(input.viewerId)
    }
  );

  ipcRegistry.register<{ viewerId: string; cooldownGapSeconds: number; cooldownPeriodMins?: number | null }, { success: boolean; error?: string }>(
    'viewer-tts-rules:set-cooldown',
    {
      validate: (input) => {
        if (!input?.viewerId) return 'Viewer ID is required';
        if (typeof input.cooldownGapSeconds !== 'number' || input.cooldownGapSeconds < 1) {
          return 'Cooldown gap must be at least 1 second';
        }
        return null;
      },
      execute: async (input) => {
        return getViewerTTSRulesRepo().setCooldown(input.viewerId, {
          cooldown_gap_seconds: input.cooldownGapSeconds,
          cooldown_period_mins: input.cooldownPeriodMins
        });
      }
    }
  );

  ipcRegistry.register<{ viewerId: string }, { success: boolean; error?: string }>(
    'viewer-tts-rules:remove-cooldown',
    {
      validate: (input) => input?.viewerId ? null : 'Viewer ID is required',
      execute: async (input) => getViewerTTSRulesRepo().removeCooldown(input.viewerId)
    }
  );

  ipcRegistry.register<{ viewerId: string }, { success: boolean; error?: string }>(
    'viewer-tts-rules:clear-all',
    {
      validate: (input) => input?.viewerId ? null : 'Viewer ID is required',
      execute: async (input) => getViewerTTSRulesRepo().clearRules(input.viewerId)
    }
  );

  ipcRegistry.register<void, any[]>(
    'viewer-tts-rules:get-all-muted',
    {
      execute: async () => getViewerTTSRulesRepo().getAllMuted()
    }
  );

  ipcRegistry.register<void, any[]>(
    'viewer-tts-rules:get-all-cooldown',
    {
      execute: async () => getViewerTTSRulesRepo().getAllWithCooldown()
    }
  );
  // ===== Viewer History & Details =====
  ipcRegistry.register<string, any>(
    'viewer:get-detailed-history',
    {
      validate: (viewerId) => viewerId ? null : 'Viewer ID is required',
      execute: async (viewerId) => {
        const history = getViewerHistoryRepo().getViewerDetailedHistory(viewerId);
        return history || { error: 'Viewer not found' };
      }
    }
  );

  ipcRegistry.register<string, any>(
    'viewer:get-stats',
    {
      validate: (viewerId) => viewerId ? null : 'Viewer ID is required',
      execute: async (viewerId) => getViewerHistoryRepo().getViewerStats(viewerId)
    }
  );

  // ===== Viewer Moderation Actions =====
  ipcRegistry.register<{
    broadcasterId: string;
    userId: string;
    displayName: string;
    reason: string;
    accessToken: string;
    clientId: string;
  }, any>(
    'viewer:ban',
    {
      validate: (input) => {
        if (!input?.broadcasterId) return 'Broadcaster ID is required';
        if (!input?.userId) return 'User ID is required';
        if (!input?.displayName) return 'Display name is required';
        if (!input?.accessToken) return 'Access token is required';
        if (!input?.clientId) return 'Client ID is required';
        return null;
      },
      execute: async (input) => getModerationActionsService().banUser(
        input.broadcasterId,
        input.userId,
        input.displayName,
        input.reason,
        input.accessToken,
        input.clientId
      )
    }
  );
  ipcRegistry.register<{
    broadcasterId: string;
    userId: string;
    displayName: string;
    accessToken: string;
    clientId: string;
  }, any>(
    'viewer:unban',
    {
      validate: (input) => {
        if (!input?.broadcasterId) return 'Broadcaster ID is required';
        if (!input?.userId) return 'User ID is required';
        if (!input?.displayName) return 'Display name is required';
        if (!input?.accessToken) return 'Access token is required';
        if (!input?.clientId) return 'Client ID is required';
        return null;
      },
      execute: async (input) => getModerationActionsService().unbanUser(
        input.broadcasterId,
        input.userId,
        input.displayName,
        input.accessToken,
        input.clientId
      )
    }
  );

  ipcRegistry.register<{
    broadcasterId: string;
    userId: string;
    displayName: string;
    durationSeconds: number;
    reason: string;
    accessToken: string;
    clientId: string;
  }, any>(
    'viewer:timeout',
    {
      validate: (input) => {
        if (!input?.broadcasterId) return 'Broadcaster ID is required';
        if (!input?.userId) return 'User ID is required';
        if (!input?.displayName) return 'Display name is required';
        if (!input?.durationSeconds) return 'Duration is required';
        if (!input?.accessToken) return 'Access token is required';
        if (!input?.clientId) return 'Client ID is required';
        return null;
      },
      execute: async (input) => getModerationActionsService().timeoutUser(
        input.broadcasterId,
        input.userId,
        input.displayName,
        input.durationSeconds,
        input.reason,
        input.accessToken,
        input.clientId
      )
    }
  );

  ipcRegistry.register<{
    broadcasterId: string;
    userId: string;
    displayName: string;
    accessToken: string;
    clientId: string;
  }, any>(
    'viewer:add-mod',
    {
      validate: (input) => {
        if (!input?.broadcasterId) return 'Broadcaster ID is required';
        if (!input?.userId) return 'User ID is required';
        if (!input?.displayName) return 'Display name is required';
        if (!input?.accessToken) return 'Access token is required';
        if (!input?.clientId) return 'Client ID is required';
        return null;
      },
      execute: async (input) => getModerationActionsService().addModerator(
        input.broadcasterId,
        input.userId,
        input.displayName,
        input.accessToken,
        input.clientId
      )
    }
  );

  ipcRegistry.register<{
    broadcasterId: string;
    userId: string;
    displayName: string;
    accessToken: string;
    clientId: string;
  }, any>(
    'viewer:remove-mod',
    {
      validate: (input) => {
        if (!input?.broadcasterId) return 'Broadcaster ID is required';
        if (!input?.userId) return 'User ID is required';
        if (!input?.displayName) return 'Display name is required';
        if (!input?.accessToken) return 'Access token is required';
        if (!input?.clientId) return 'Client ID is required';
        return null;
      },
      execute: async (input) => getModerationActionsService().removeModerator(
        input.broadcasterId,
        input.userId,
        input.displayName,
        input.accessToken,
        input.clientId
      )
    }
  );

  ipcRegistry.register<{
    broadcasterId: string;
    userId: string;
    displayName: string;
    accessToken: string;
    clientId: string;
  }, any>(
    'viewer:add-vip',
    {
      validate: (input) => {
        if (!input?.broadcasterId) return 'Broadcaster ID is required';
        if (!input?.userId) return 'User ID is required';
        if (!input?.displayName) return 'Display name is required';
        if (!input?.accessToken) return 'Access token is required';
        if (!input?.clientId) return 'Client ID is required';
        return null;
      },
      execute: async (input) => getModerationActionsService().addVIP(
        input.broadcasterId,
        input.userId,
        input.displayName,
        input.accessToken,
        input.clientId
      )
    }
  );  ipcRegistry.register<{
    broadcasterId: string;
    userId: string;
    displayName: string;
    accessToken: string;
    clientId: string;
  }, any>(
    'viewer:remove-vip',
    {
      validate: (input) => {
        if (!input?.broadcasterId) return 'Broadcaster ID is required';
        if (!input?.userId) return 'User ID is required';
        if (!input?.displayName) return 'Display name is required';
        if (!input?.accessToken) return 'Access token is required';
        if (!input?.clientId) return 'Client ID is required';
        return null;
      },
      execute: async (input) => getModerationActionsService().removeVIP(
        input.broadcasterId,
        input.userId,
        input.displayName,
        input.accessToken,
        input.clientId
      )
    }
  );

  // Debug handler to check raw database tables
  ipcRegistry.register<{ viewerId: string }, any>(
    'debug:viewer-data',
    {
      validate: (input) => {
        if (!input?.viewerId) return 'Viewer ID is required';
        return null;
      },
      execute: async (input) => {
        const { getDatabase } = await import('../../database/connection');
        const db = getDatabase();
        
        return {
          viewer: db.prepare('SELECT * FROM viewers WHERE id = ?').get(input.viewerId),
          moderation: db.prepare('SELECT * FROM moderation_history WHERE viewer_id = ? ORDER BY action_at DESC').all(input.viewerId),
          roles: db.prepare('SELECT * FROM viewer_roles WHERE viewer_id = ? ORDER BY granted_at DESC').all(input.viewerId),
          follower: db.prepare('SELECT * FROM follower_history WHERE viewer_id = ? ORDER BY detected_at DESC').all(input.viewerId),
          subscriptions: db.prepare('SELECT * FROM viewer_subscriptions WHERE viewer_id = ? ORDER BY start_date DESC').all(input.viewerId),
          status: db.prepare('SELECT * FROM viewer_subscription_status WHERE id = ?').get(input.viewerId),
          events: db.prepare('SELECT * FROM events WHERE viewer_id = ? ORDER BY created_at DESC LIMIT 10').all(input.viewerId)
        };
      }
    }
  );
}
