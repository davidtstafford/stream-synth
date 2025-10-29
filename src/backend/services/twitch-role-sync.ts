/**
 * Twitch Role Sync Service
 * 
 * Centralized service for syncing viewer roles (subscribers, VIPs, moderators) from Twitch.
 * This provides a single reusable function that can be called from:
 * - App startup
 * - Manual sync button
 * - Periodic background sync
 * - After OAuth connection
 * - EventSub triggers (stream.online, etc.)
 */

import { TwitchSubscriptionsService } from './twitch-subscriptions';
import { TwitchVIPService } from './twitch-vip';
import { TwitchModeratorsService } from './twitch-moderators';

export interface RoleSyncResult {
  success: boolean;
  subCount: number;
  vipCount: number;
  modCount: number;
  errors: string[];
  timestamp: string;
}

export class TwitchRoleSyncService {
  private subscriptionsService: TwitchSubscriptionsService;
  private vipService: TwitchVIPService;
  private moderatorsService: TwitchModeratorsService;

  constructor() {
    this.subscriptionsService = new TwitchSubscriptionsService();
    this.vipService = new TwitchVIPService();
    this.moderatorsService = new TwitchModeratorsService();
  }

  /**
   * Sync all viewer roles (subscriptions, VIPs, moderators) from Twitch in parallel
   * 
   * @param channelId - Twitch channel ID (broadcaster ID)
   * @param userId - Twitch user ID (authenticated user)
   * @param source - Source of the sync request (for logging)
   * @returns Combined result with counts and any errors
   */
  async syncAllRoles(
    channelId: string,
    userId: string,
    source: string = 'unknown'
  ): Promise<RoleSyncResult> {
    console.log(`[RoleSync:${source}] Starting sync for channel ${channelId}...`);
    const startTime = Date.now();

    try {
      // Run all three syncs in parallel for speed
      const [subResult, vipResult, modResult] = await Promise.all([
        this.subscriptionsService.syncSubscriptionsFromTwitch(channelId, userId),
        this.vipService.syncVIPsFromTwitch(channelId, userId),
        this.moderatorsService.syncModerators(channelId)
      ]);

      // Collect errors
      const errors: string[] = [];
      if (!subResult.success && subResult.error) errors.push(`Subs: ${subResult.error}`);
      if (!vipResult.success && vipResult.error) errors.push(`VIPs: ${vipResult.error}`);
      if (!modResult.success && modResult.error) errors.push(`Mods: ${modResult.error}`);

      const duration = Date.now() - startTime;
      const result: RoleSyncResult = {
        success: subResult.success && vipResult.success && modResult.success,
        subCount: subResult.count || 0,
        vipCount: vipResult.count || 0,
        modCount: modResult.count || 0,
        errors,
        timestamp: new Date().toISOString()
      };

      console.log(
        `[RoleSync:${source}] Complete in ${duration}ms: ` +
        `${result.subCount} subs, ${result.vipCount} VIPs, ${result.modCount} mods`
      );

      if (errors.length > 0) {
        console.warn(`[RoleSync:${source}] Errors:`, errors);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[RoleSync:${source}] Failed:`, errorMessage);

      return {
        success: false,
        subCount: 0,
        vipCount: 0,
        modCount: 0,
        errors: [errorMessage],
        timestamp: new Date().toISOString()
      };
    }
  }
  /**
   * Sync only subscriptions (lightweight)
   */
  async syncSubscriptionsOnly(
    channelId: string,
    userId: string,
    source: string = 'unknown'
  ): Promise<{ success: boolean; count: number; error?: string }> {
    console.log(`[RoleSync:${source}] Syncing subscriptions only...`);
    const result = await this.subscriptionsService.syncSubscriptionsFromTwitch(channelId, userId);
    return {
      success: result.success,
      count: result.count || 0,
      error: result.error
    };
  }

  /**
   * Sync only VIPs (lightweight)
   */
  async syncVIPsOnly(
    channelId: string,
    userId: string,
    source: string = 'unknown'
  ): Promise<{ success: boolean; count: number; error?: string }> {
    console.log(`[RoleSync:${source}] Syncing VIPs only...`);
    const result = await this.vipService.syncVIPsFromTwitch(channelId, userId);
    return {
      success: result.success,
      count: result.count || 0,
      error: result.error
    };
  }

  /**
   * Sync only moderators (lightweight)
   */
  async syncModeratorsOnly(
    channelId: string,
    source: string = 'unknown'
  ): Promise<{ success: boolean; count: number; error?: string }> {
    console.log(`[RoleSync:${source}] Syncing moderators only...`);
    const result = await this.moderatorsService.syncModerators(channelId);
    return {
      success: result.success,
      count: result.count || 0,
      error: result.error
    };
  }
}
