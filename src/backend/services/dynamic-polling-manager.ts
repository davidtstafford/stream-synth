/**
 * Dynamic Polling Manager
 * 
 * Manages multiple polling intervals for Twitch Helix API requests.
 * Supports dynamic interval updates without restarting the app.
 */

import { TwitchPollingConfigRepository, TwitchPollingConfig } from '../database/repositories/twitch-polling-config';
import { SessionsRepository } from '../database/repositories/sessions';
import { TwitchRoleSyncService } from './twitch-role-sync';

type ApiType = TwitchPollingConfig['api_type'];
type PollingCallback = () => Promise<void>;

interface ActivePoller {
  apiType: ApiType;
  intervalId: NodeJS.Timeout;
  intervalMs: number;
  callback: PollingCallback;
}

export class DynamicPollingManager {
  private activePollers: Map<ApiType, ActivePoller> = new Map();
  private pollingConfigRepo: TwitchPollingConfigRepository;
  private sessionsRepo: SessionsRepository;
  private roleSyncService: TwitchRoleSyncService;

  constructor() {
    this.pollingConfigRepo = new TwitchPollingConfigRepository();
    this.sessionsRepo = new SessionsRepository();
    this.roleSyncService = new TwitchRoleSyncService();
  }

  /**
   * Initialize all polling timers based on database config
   */
  async initialize(): Promise<void> {
    console.log('[PollingManager] Initializing dynamic polling manager...');

    const configs = this.pollingConfigRepo.getAllConfigs();
    
    for (const config of configs) {
      if (config.enabled && config.interval_minutes > 0) {
        this.startPoller(config.api_type, config.interval_minutes);
      } else {
        console.log(`[PollingManager] Skipping disabled poller: ${config.api_type}`);
      }
    }

    console.log(`[PollingManager] Initialized ${this.activePollers.size} active pollers`);
  }

  /**
   * Start a polling timer for a specific API type
   */
  private startPoller(apiType: ApiType, intervalMinutes: number): void {
    // Stop existing poller if running
    this.stopPoller(apiType);

    const intervalMs = intervalMinutes * 60 * 1000;
    const callback = this.getPollingCallback(apiType);

    console.log(`[PollingManager] Starting poller for ${apiType} (every ${intervalMinutes} minutes)`);

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
  }

  /**
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
          const result = await this.roleSyncService.syncAllRoles(
            currentSession.channel_id,
            currentSession.user_id,
            'scheduled-poll'
          );          if (!result.success) {
            console.warn('[PollingManager] Role sync had errors:', result.errors);
          } else {
            const total = result.subCount + result.vipCount + result.modCount;
            console.log(`[PollingManager] Role sync completed successfully (${total} total: ${result.subCount} subs, ${result.vipCount} VIPs, ${result.modCount} mods)`);
          }        };

      default:
        return async () => {
          console.warn(`[PollingManager] Unknown API type: ${apiType}`);
        };
    }
  }

  /**
   * Update polling interval for a specific API type (dynamic update)
   */
  updateInterval(apiType: ApiType, intervalMinutes: number): void {
    console.log(`[PollingManager] Updating interval for ${apiType} to ${intervalMinutes} minutes`);

    // Update database
    this.pollingConfigRepo.updateInterval(apiType, intervalMinutes);

    // Restart poller with new interval
    this.startPoller(apiType, intervalMinutes);
  }

  /**
   * Enable or disable polling for a specific API type
   */
  setEnabled(apiType: ApiType, enabled: boolean): void {
    console.log(`[PollingManager] ${enabled ? 'Enabling' : 'Disabling'} poller for ${apiType}`);

    // Update database
    this.pollingConfigRepo.setEnabled(apiType, enabled);

    if (enabled) {
      const config = this.pollingConfigRepo.getConfig(apiType);
      if (config) {
        this.startPoller(apiType, config.interval_minutes);
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
    intervalMinutes: number;
    lastPollAt: string | null;
    isRunning: boolean;
  }> {
    const configs = this.pollingConfigRepo.getAllConfigs();
    
    return configs.map(config => ({
      apiType: config.api_type,
      enabled: config.enabled,
      intervalMinutes: config.interval_minutes,
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
