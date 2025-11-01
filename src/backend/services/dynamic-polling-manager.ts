/**
 * Dynamic Polling Manager
 * 
 * Manages multiple polling intervals for Twitch Helix API requests.
 * Supports dynamic interval updates without restarting the app.
 */

import { TwitchPollingConfigRepository, TwitchPollingConfig, ApiType } from '../database/repositories/twitch-polling-config';
import { SessionsRepository } from '../database/repositories/sessions';
import { TwitchRoleSyncService } from './twitch-role-sync';
import { TwitchFollowersService } from './twitch-followers';
import { TwitchModerationService } from './twitch-moderation';
import { EventsRepository } from '../database/repositories/events';
import { ViewerRolesRepository } from '../database/repositories/viewer-roles';
import { SubscriptionsRepository } from '../database/repositories/subscriptions';
import { PollingEventFormatter } from './polling-event-formatter';
import { ViewersRepository } from '../database/repositories/viewers';

type PollingCallback = () => Promise<void>;

interface ActivePoller {
  apiType: ApiType;
  intervalId: NodeJS.Timeout;
  intervalMs: number;
  callback: PollingCallback;
}

// State tracking for role changes
interface RoleState {
  subscribers: Set<string>; // viewer IDs
  vips: Set<string>;
  moderators: Set<string>;
}

export class DynamicPollingManager {
  private activePollers: Map<ApiType, ActivePoller> = new Map();
  private pollingConfigRepo: TwitchPollingConfigRepository;
  private sessionsRepo: SessionsRepository;
  private eventsRepo: EventsRepository;
  private viewerRolesRepo: ViewerRolesRepository;
  private subscriptionsRepo: SubscriptionsRepository;  private viewersRepo: ViewersRepository;
  private roleSyncService: TwitchRoleSyncService;
  private followersService: TwitchFollowersService;
  private moderationService: TwitchModerationService;
  private lastFollowerId: string | null = null;
  
  // Track previous role state for change detection
  private previousRoleState: RoleState | null = null;
  constructor() {
    this.pollingConfigRepo = new TwitchPollingConfigRepository();
    this.sessionsRepo = new SessionsRepository();
    this.eventsRepo = new EventsRepository();
    this.viewerRolesRepo = new ViewerRolesRepository();
    this.subscriptionsRepo = new SubscriptionsRepository();
    this.viewersRepo = new ViewersRepository();
    this.roleSyncService = new TwitchRoleSyncService();
    this.followersService = new TwitchFollowersService();
    this.moderationService = new TwitchModerationService();
  }
  /**
   * Initialize all polling timers based on database config
   */
  async initialize(): Promise<void> {
    console.log('[PollingManager] Initializing dynamic polling manager...');

    const configs = this.pollingConfigRepo.getAllConfigs();
    
    for (const config of configs) {
      if (config.enabled) {
        const intervalMs = this.pollingConfigRepo.getIntervalMs(config.api_type);
        if (intervalMs > 0) {
          this.startPoller(config.api_type, intervalMs);
        }
      } else {
        console.log(`[PollingManager] Skipping disabled poller: ${config.api_type}`);
      }
    }

    console.log(`[PollingManager] Initialized ${this.activePollers.size} active pollers`);
  }

  /**
   * Start a polling timer for a specific API type
   */
  private startPoller(apiType: ApiType, intervalMs: number): void {
    // Stop existing poller if running
    this.stopPoller(apiType);

    const callback = this.getPollingCallback(apiType);

    console.log(`[PollingManager] Starting poller for ${apiType} (every ${intervalMs}ms)`);

    const intervalId = setInterval(async () => {
      try {
        await callback();
        this.pollingConfigRepo.updateLastPoll(apiType);
      } catch (err: any) {
        console.error(`[PollingManager] Error in ${apiType} poller:`, err);
      }
    }, intervalMs);

    this.activePollers.set(apiType, {
      apiType,
      intervalId,
      intervalMs,
      callback,
    });
  }

  /**
   * Stop a polling timer for a specific API type
   */
  private stopPoller(apiType: ApiType): void {
    const poller = this.activePollers.get(apiType);
    if (poller) {
      console.log(`[PollingManager] Stopping poller for ${apiType}`);
      clearInterval(poller.intervalId);
      this.activePollers.delete(apiType);
    }
  }  /**
   * Get the polling callback function for a specific API type
   */
  private getPollingCallback(apiType: ApiType): PollingCallback {
    switch (apiType) {
      case 'role_sync':
        return async () => {
          const currentSession = this.sessionsRepo.getCurrentSession();
          if (!currentSession) {
            console.log('[PollingManager] Skipping role_sync - no active session');
            return;
          }

          console.log('[PollingManager] Running scheduled role_sync...');
          
          // Get current role state BEFORE sync
          const previousState = this.getCurrentRoleState(currentSession.channel_id);
          
          // Perform the sync
          const result = await this.roleSyncService.syncAllRoles(
            currentSession.channel_id,
            currentSession.user_id,
            'scheduled-poll'
          );

          if (!result.success) {
            console.warn('[PollingManager] Role sync had errors:', result.errors);
          } else {
            const total = result.subCount + result.vipCount + result.modCount;
            console.log(`[PollingManager] Role sync completed successfully (${total} total: ${result.subCount} subs, ${result.vipCount} VIPs, ${result.modCount} mods)`);
          }
          
          // Get current role state AFTER sync
          const currentState = this.getCurrentRoleState(currentSession.channel_id);
          
          // Detect and record role changes as events
          if (previousState) {
            await this.detectAndRecordRoleChanges(
              previousState,
              currentState,
              currentSession.channel_id
            );
          }
          
          // Update stored state for next comparison
          this.previousRoleState = currentState;
        };      case 'followers':
        return async () => {
          const currentSession = this.sessionsRepo.getCurrentSession();
          if (!currentSession) {
            console.log('[PollingManager] Skipping followers - no active session');
            return;
          }

          console.log('[PollingManager] Running scheduled follower sync...');
          
          const result = await this.followersService.syncFollowersFromTwitch(
            currentSession.user_id, // broadcasterId
            currentSession.user_id, // userId (for token)
            currentSession.channel_id
          );

          if (!result.success) {
            console.warn('[PollingManager] Follower sync failed:', result.error);
            return;
          }          console.log(`[PollingManager] Follower sync completed: ${result.newFollowers} new, ${result.unfollowers} unfollowed, ${result.total} total`);

          // Record follower events
          if (result.newFollowers && result.newFollowers > 0) {
            console.log(`[PollingManager] ${result.newFollowers} new followers detected - events already recorded in follower_history`);
          }

          if (result.unfollowers && result.unfollowers > 0) {
            console.log(`[PollingManager] ${result.unfollowers} unfollowers detected - events already recorded in follower_history`);
          }
        };      case 'moderation':
        return async () => {
          const currentSession = this.sessionsRepo.getCurrentSession();
          if (!currentSession) {
            console.log('[PollingManager] Skipping moderation - no active session');
            return;
          }

          console.log('[PollingManager] Running scheduled moderation status poll...');
          
          // Get tokens from database (same pattern as follower sync)
          const { TokensRepository } = require('../database/repositories/tokens');
          const tokensRepo = new TokensRepository();
          const token = tokensRepo.get(currentSession.user_id);

          if (!token?.accessToken || !token?.clientId) {
            console.warn('[PollingManager] Skipping moderation - no valid tokens for user:', currentSession.user_id);
            return;
          }

          const result = await this.moderationService.syncModerationStatus(
            currentSession.channel_id,
            currentSession.user_id,
            token.accessToken,
            token.clientId
          );

          if (!result.success) {
            console.warn('[PollingManager] Moderation sync failed:', result.error);
            return;
          }

          console.log(`[PollingManager] Moderation sync completed successfully`);
        };

      default:
        return async () => {
          console.warn(`[PollingManager] Unknown API type: ${apiType}`);
        };
    }
  }
  /**
   * Get current role state from database
   */
  private getCurrentRoleState(channelId: string): RoleState {
    const subscribers = new Set<string>();
    const vips = new Set<string>();
    const moderators = new Set<string>();
    
    // Get all VIPs
    const vipList = this.viewerRolesRepo.getAllVIPs();
    for (const vip of vipList) {
      vips.add(vip.viewer_id);
    }
    
    // Get all moderators
    const modList = this.viewerRolesRepo.getAllModerators();
    for (const mod of modList) {
      moderators.add(mod.viewer_id);
    }
    
    // Get all subscribers from subscriptions table
    const subList = this.subscriptionsRepo.getActiveSubscribers();
    for (const sub of subList) {
      subscribers.add(sub.id);
    }
    
    return { subscribers, vips, moderators };
  }
  
  /**
   * Detect role changes and write events to database
   */
  private async detectAndRecordRoleChanges(
    previousState: RoleState,
    currentState: RoleState,
    channelId: string
  ): Promise<void> {
    const events: Array<{
      eventType: string;
      eventData: any;
      channelId: string;
      viewerId: string | null;
    }> = [];
    
    // Detect subscriber changes
    const newSubscribers = Array.from(currentState.subscribers).filter(
      id => !previousState.subscribers.has(id)
    );
    const removedSubscribers = Array.from(previousState.subscribers).filter(
      id => !currentState.subscribers.has(id)
    );
    
    for (const viewerId of newSubscribers) {
      const viewer = this.viewersRepo.getViewerById(viewerId);
      if (viewer) {
        const eventData = PollingEventFormatter.formatRoleEvent(
          'granted',
          'subscriber',
          viewer.username,
          viewerId
        );
        events.push({
          eventType: eventData.event_type,
          eventData: eventData.details,
          channelId,
          viewerId: eventData.viewer_id
        });
      }
    }
    
    for (const viewerId of removedSubscribers) {
      const viewer = this.viewersRepo.getViewerById(viewerId);
      if (viewer) {
        const eventData = PollingEventFormatter.formatRoleEvent(
          'revoked',
          'subscriber',
          viewer.username,
          viewerId
        );
        events.push({
          eventType: eventData.event_type,
          eventData: eventData.details,
          channelId,
          viewerId: eventData.viewer_id
        });
      }
    }
    
    // Detect VIP changes
    const newVips = Array.from(currentState.vips).filter(
      id => !previousState.vips.has(id)
    );
    const removedVips = Array.from(previousState.vips).filter(
      id => !currentState.vips.has(id)
    );
    
    for (const viewerId of newVips) {
      const viewer = this.viewersRepo.getViewerById(viewerId);
      if (viewer) {
        const eventData = PollingEventFormatter.formatRoleEvent(
          'granted',
          'vip',
          viewer.username,
          viewerId
        );
        events.push({
          eventType: eventData.event_type,
          eventData: eventData.details,
          channelId,
          viewerId: eventData.viewer_id
        });
      }
    }
    
    for (const viewerId of removedVips) {
      const viewer = this.viewersRepo.getViewerById(viewerId);
      if (viewer) {
        const eventData = PollingEventFormatter.formatRoleEvent(
          'revoked',
          'vip',
          viewer.username,
          viewerId
        );
        events.push({
          eventType: eventData.event_type,
          eventData: eventData.details,
          channelId,
          viewerId: eventData.viewer_id
        });
      }
    }
    
    // Detect moderator changes
    const newModerators = Array.from(currentState.moderators).filter(
      id => !previousState.moderators.has(id)
    );
    const removedModerators = Array.from(previousState.moderators).filter(
      id => !currentState.moderators.has(id)
    );
    
    for (const viewerId of newModerators) {
      const viewer = this.viewersRepo.getViewerById(viewerId);
      if (viewer) {
        const eventData = PollingEventFormatter.formatRoleEvent(
          'granted',
          'moderator',
          viewer.username,
          viewerId
        );
        events.push({
          eventType: eventData.event_type,
          eventData: eventData.details,
          channelId,
          viewerId: eventData.viewer_id
        });
      }
    }
    
    for (const viewerId of removedModerators) {
      const viewer = this.viewersRepo.getViewerById(viewerId);
      if (viewer) {
        const eventData = PollingEventFormatter.formatRoleEvent(
          'revoked',
          'moderator',
          viewer.username,
          viewerId
        );
        events.push({
          eventType: eventData.event_type,
          eventData: eventData.details,
          channelId,
          viewerId: eventData.viewer_id
        });
      }
    }
    
    // Batch insert all events
    if (events.length > 0) {
      this.eventsRepo.batchInsertEvents(events);
      console.log(`[PollingManager] Recorded ${events.length} role change events`);
    }
  }
  /**
   * Update polling interval for a specific API type (dynamic update)
   */
  updateInterval(apiType: ApiType, intervalValue: number): void {
    console.log(`[PollingManager] Updating interval for ${apiType} to ${intervalValue}`);

    // Update database (validates against min/max)
    this.pollingConfigRepo.updateInterval(apiType, intervalValue);

    // Restart poller with new interval
    const intervalMs = this.pollingConfigRepo.getIntervalMs(apiType);
    if (intervalMs > 0) {
      this.startPoller(apiType, intervalMs);
    }
  }

  /**
   * Enable or disable polling for a specific API type
   */
  setEnabled(apiType: ApiType, enabled: boolean): void {
    console.log(`[PollingManager] ${enabled ? 'Enabling' : 'Disabling'} poller for ${apiType}`);

    // Update database
    this.pollingConfigRepo.setEnabled(apiType, enabled);

    if (enabled) {
      const intervalMs = this.pollingConfigRepo.getIntervalMs(apiType);
      if (intervalMs > 0) {
        this.startPoller(apiType, intervalMs);
      }
    } else {
      this.stopPoller(apiType);
    }
  }

  /**
   * Get status of all active pollers
   */
  getStatus(): Array<{
    apiType: ApiType;
    enabled: boolean;
    intervalValue: number;
    intervalUnits: string;
    lastPollAt: string | null;
    isRunning: boolean;
  }> {
    const configs = this.pollingConfigRepo.getAllConfigs();
    
    return configs.map(config => ({
      apiType: config.api_type,
      enabled: config.enabled,
      intervalValue: config.interval_value,
      intervalUnits: config.interval_units,
      lastPollAt: config.last_poll_at,
      isRunning: this.activePollers.has(config.api_type),
    }));
  }

  /**
   * Stop all polling timers (for cleanup)
   */
  shutdown(): void {
    console.log('[PollingManager] Shutting down all pollers...');
    
    for (const [apiType, poller] of this.activePollers) {
      clearInterval(poller.intervalId);
      console.log(`[PollingManager] Stopped poller: ${apiType}`);
    }
    
    this.activePollers.clear();
    console.log('[PollingManager] Shutdown complete');
  }
}
