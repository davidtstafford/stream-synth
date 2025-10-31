/**
 * Twitch IPC Handlers
 * 
 * Handles Twitch-related operations via IPC using centralized IPC Framework:
 * - OAuth authentication
 * - WebSocket connection
 * - Export/Import settings
 * - Subscription syncing
 * - Follower syncing
 * 
 * Phase 3: Migrated to use IPCRegistry for consistent error handling
 */

import { BrowserWindow, session } from 'electron';
import { ipcRegistry } from '../ipc/ipc-framework';
import { authenticateWithTwitch } from '../../auth/twitch-oauth';
import { exportSettings, importSettings, getExportPreview } from '../../services/export-import';
import { TwitchRoleSyncService } from '../../services/twitch-role-sync';
import { TwitchFollowersService } from '../../services/twitch-followers';
import { getDatabase } from '../../database/connection';
import { getEventSubManager } from '../../services/eventsub-manager';

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

  // Clear Twitch OAuth session cache
  ipcRegistry.register<void, void>(
    'clear-twitch-oauth-cache',
    {
      execute: async () => {
        console.log('[Twitch] Clearing OAuth session cache...');
        const ses = session.defaultSession;
        
        // Clear all Twitch-related storage
        await ses.clearStorageData({
          storages: ['cookies', 'localstorage'],
          origin: 'https://id.twitch.tv'
        });
        
        // Clear cache
        await ses.clearCache();
        
        console.log('[Twitch] OAuth cache cleared successfully');
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
  );  // ===== Subscriptions & VIPs & Moderators =====
  ipcRegistry.register<void, { success: boolean; subCount?: number; vipCount?: number; modCount?: number; error?: string }>(
    'twitch:sync-subscriptions-from-twitch',
    {
      execute: async () => {
        const sessionsRepo = require('../../database/repositories/sessions').SessionsRepository;
        const session = new sessionsRepo().getCurrentSession();

        if (!session) {
          throw new Error('Not connected to Twitch. Please connect first.');
        }

        // Use centralized sync service
        const roleSyncService = new TwitchRoleSyncService();
        const result = await roleSyncService.syncAllRoles(
          session.channel_id,
          session.user_id,
          'manual-ui'
        );

        return {
          success: result.success,
          subCount: result.subCount,
          vipCount: result.vipCount,
          modCount: result.modCount,
          error: result.errors.length > 0 ? result.errors.join(', ') : undefined
        };
      }
    }
  );
  // ===== Followers =====
  ipcRegistry.register<void, { success: boolean; newFollowers?: number; unfollowers?: number; total?: number; error?: string }>(
    'twitch:sync-followers-from-twitch',
    {
      execute: async () => {
        const sessionsRepo = require('../../database/repositories/sessions').SessionsRepository;
        const session = new sessionsRepo().getCurrentSession();

        if (!session) {
          throw new Error('Not connected to Twitch. Please connect first.');
        }

        // Use centralized followers sync service
        const followersService = new TwitchFollowersService();
        const result = await followersService.syncFollowersFromTwitch(
          session.user_id, // broadcasterId
          session.user_id, // userId (for token)
          session.channel_id
        );

        return {
          success: result.success,
          newFollowers: result.newFollowers,
          unfollowers: result.unfollowers,
          total: result.total,
          error: result.error
        };
      }
    }
  );

  ipcRegistry.register<void, any[]>(
    'twitch:get-current-followers',
    {
      execute: async () => {
        const sessionsRepo = require('../../database/repositories/sessions').SessionsRepository;
        const session = new sessionsRepo().getCurrentSession();

        if (!session) {
          throw new Error('Not connected to Twitch. Please connect first.');
        }

        // Use centralized followers service to get current followers
        const followersService = new TwitchFollowersService();
        return followersService.getCurrentFollowers(session.channel_id);
      }
    }
  );

  ipcRegistry.register<void, number>(
    'twitch:get-follower-count',
    {
      execute: async () => {
        const sessionsRepo = require('../../database/repositories/sessions').SessionsRepository;
        const session = new sessionsRepo().getCurrentSession();

        if (!session) {
          throw new Error('Not connected to Twitch. Please connect first.');
        }

        const followersService = new TwitchFollowersService();
        return followersService.getFollowerCount(session.channel_id);
      }
    }
  );
  ipcRegistry.register<{ limit?: number }, any[]>(
    'twitch:get-recent-follower-events',
    {
      execute: async (args) => {
        const sessionsRepo = require('../../database/repositories/sessions').SessionsRepository;
        const session = new sessionsRepo().getCurrentSession();

        if (!session) {
          throw new Error('Not connected to Twitch. Please connect first.');
        }

        const followersService = new TwitchFollowersService();
        const limit = args?.limit || 50;
        return followersService.getRecentFollowerEvents(session.channel_id, limit);
      }
    }
  );

  // ===== Moderation Status Handlers =====
  ipcRegistry.register<void, void>(
    'twitch:sync-moderation-status',
    {
      execute: async () => {
        const sessionsRepo = require('../../database/repositories/sessions').SessionsRepository;
        const tokensRepo = require('../../database/repositories/tokens').TokensRepository;
        const session = new sessionsRepo().getCurrentSession();
        const tokens = new tokensRepo().getTokens();

        if (!session) {
          throw new Error('Not connected to Twitch. Please connect first.');
        }

        if (!tokens?.access_token || !tokens?.client_id) {
          throw new Error('No valid access token found. Please reconnect.');
        }

        const { TwitchModerationService } = require('../../services/twitch-moderation');
        const moderationService = new TwitchModerationService();
        
        const result = await moderationService.syncModerationStatus(
          session.channel_id,
          session.user_id,
          tokens.access_token,
          tokens.client_id
        );

        if (!result.success) {
          throw new Error(result.error || 'Failed to sync moderation status');
        }
      }
    }
  );

  ipcRegistry.register<void, any[]>(
    'twitch:get-active-moderations',
    {
      execute: async () => {
        const sessionsRepo = require('../../database/repositories/sessions').SessionsRepository;
        const session = new sessionsRepo().getCurrentSession();

        if (!session) {
          throw new Error('Not connected to Twitch. Please connect first.');
        }

        const { ModerationHistoryRepository } = require('../../database/repositories/moderation-history');
        const moderationRepo = new ModerationHistoryRepository();
        const result = moderationRepo.getActiveModerations(session.channel_id);

        if (!result.success) {
          throw new Error(result.error || 'Failed to get active moderations');
        }

        return result.moderations || [];
      }
    }
  );

  ipcRegistry.register<{ limit?: number }, any[]>(
    'twitch:get-recent-moderation-events',
    {
      execute: async (args) => {
        const sessionsRepo = require('../../database/repositories/sessions').SessionsRepository;
        const session = new sessionsRepo().getCurrentSession();

        if (!session) {
          throw new Error('Not connected to Twitch. Please connect first.');
        }

        const { ModerationHistoryRepository } = require('../../database/repositories/moderation-history');
        const moderationRepo = new ModerationHistoryRepository();
        const limit = args?.limit || 50;
        const result = moderationRepo.getRecentEvents(session.channel_id, limit);

        if (!result.success) {
          throw new Error(result.error || 'Failed to get recent moderation events');
        }

        return result.events || [];
      }
    }
  );

  ipcRegistry.register<void, { bans: number; timeouts: number }>(
    'twitch:get-moderation-counts',
    {
      execute: async () => {
        const sessionsRepo = require('../../database/repositories/sessions').SessionsRepository;
        const session = new sessionsRepo().getCurrentSession();

        if (!session) {
          throw new Error('Not connected to Twitch. Please connect first.');
        }

        const { ModerationHistoryRepository } = require('../../database/repositories/moderation-history');
        const moderationRepo = new ModerationHistoryRepository();
          return {
          bans: moderationRepo.getActiveBansCount(session.channel_id),
          timeouts: moderationRepo.getActiveTimeoutsCount(session.channel_id)
        };
      }
    }  );

  // ===== EventSub WebSocket Handlers (Phase 7) =====
  
  ipcRegistry.register<void, {
    connected: boolean;
    sessionId: string | null;
    subscriptions: Array<{ type: string; condition: Record<string, string> }>;
    subscriptionCount: number;
    lastConnectedAt: string | null;
    nextKeepaliveAt: string | null;
    reconnectAttempts: number;
  }>(
    'eventsub-get-status',
    {
      execute: async () => {
        const manager = getEventSubManager();
        const status = manager.getStatus();
        
        // Transform backend status to match frontend expectations
        return {
          connected: status.isConnected,  // Transform: isConnected → connected
          sessionId: status.sessionId,
          // Transform: string[] → { type, condition }[]
          subscriptions: status.subscriptions.map(eventType => ({
            type: eventType,
            condition: {
              broadcaster_user_id: 'BROADCASTER_ID' // Placeholder - we don't track conditions
            }
          })),
          subscriptionCount: status.subscriptionCount,
          lastConnectedAt: status.lastConnectedAt,
          nextKeepaliveAt: status.nextKeepaliveAt,
          reconnectAttempts: status.reconnectAttempts
        };
      },
    }
  );

  ipcRegistry.register<
    { userId: string; channelId: string },
    { success: boolean; message: string }
  >(
    'eventsub-initialize',
    {
      validate: (input: { userId: string; channelId: string }) => {
        if (!input.userId) return 'userId is required';
        if (!input.channelId) return 'channelId is required';
        return null;
      },
      execute: async (input: { userId: string; channelId: string }) => {
        try {
          const manager = getEventSubManager();
          await manager.initialize(input.userId, input.channelId);
          return {
            success: true,
            message: 'EventSub connection initialized',
          };
        } catch (error: any) {
          return {
            success: false,
            message: error.message || 'Failed to initialize EventSub',
          };
        }
      },
    }
  );

  ipcRegistry.register<void, { success: boolean; message: string }>(
    'eventsub-disconnect',
    {
      execute: async () => {
        try {
          const manager = getEventSubManager();
          manager.destroy();
          return {
            success: true,
            message: 'EventSub disconnected',
          };
        } catch (error: any) {
          return {
            success: false,
            message: error.message || 'Failed to disconnect EventSub',
          };
        }
      },
    }
  );

  ipcRegistry.register<
    void,
    Array<{
      type: string;
      displayName: string;
      description: string;
    }>
  >(
    'eventsub-get-subscription-types',
    {
      execute: async () => {
        return [
          {
            type: 'channel.follow',
            displayName: 'New Follower',
            description: 'When someone follows the channel',
          },
          {
            type: 'channel.subscribe',
            displayName: 'New Subscription',
            description: 'When someone subscribes to the channel',
          },
          {
            type: 'channel.subscription.end',
            displayName: 'Subscription Ended',
            description: 'When a subscription expires',
          },
          {
            type: 'channel.subscription.gift',
            displayName: 'Gifted Subscription',
            description: 'When someone gifts a subscription',
          },
          {
            type: 'channel.moderator.add',
            displayName: 'Moderator Added',
            description: 'When someone is promoted to moderator',
          },
          {
            type: 'channel.moderator.remove',
            displayName: 'Moderator Removed',
            description: 'When someone loses moderator status',
          },
          {
            type: 'channel.vip.add',
            displayName: 'VIP Added',
            description: 'When someone is promoted to VIP',
          },
          {
            type: 'channel.vip.remove',
            displayName: 'VIP Removed',
            description: 'When someone loses VIP status',
          },
        ];
      },
    }
  );
}
