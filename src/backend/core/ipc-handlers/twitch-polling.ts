/**
 * Twitch Polling Config IPC Handlers
 * 
 * Provides frontend access to configure Twitch API polling intervals.
 */

import { ipcMain } from 'electron';
import { TwitchPollingConfigRepository } from '../../database/repositories/twitch-polling-config';
import { getPollingManager } from './startup';

const pollingConfigRepo = new TwitchPollingConfigRepository();

/**
 * Get all polling configurations
 */
ipcMain.handle('twitch-polling:get-all-configs', async () => {
  try {
    const configs = pollingConfigRepo.getAllConfigs();
    
    // Add runtime status from polling manager
    const manager = getPollingManager();
    const status = manager?.getStatus() || [];
    
    return configs.map(config => ({
      ...config,
      enabled: Boolean(config.enabled),
      isRunning: status.find(s => s.apiType === config.api_type)?.isRunning || false,
    }));
  } catch (error: any) {
    console.error('[IPC] Error getting polling configs:', error);
    throw error;
  }
});

/**
 * Get specific polling configuration
 */
ipcMain.handle('twitch-polling:get-config', async (_, apiType: string) => {
  try {
    const config = pollingConfigRepo.getConfig(apiType as any);
    if (!config) {
      throw new Error(`Config not found for API type: ${apiType}`);
    }
    
    return {
      ...config,
      enabled: Boolean(config.enabled),
    };
  } catch (error: any) {
    console.error('[IPC] Error getting polling config:', error);
    throw error;
  }
});

/**
 * Update polling interval
 */
ipcMain.handle('twitch-polling:update-interval', async (_, apiType: string, intervalMinutes: number) => {
  try {
    console.log(`[IPC] Updating polling interval for ${apiType} to ${intervalMinutes} minutes`);
    
    // Update database
    pollingConfigRepo.updateInterval(apiType as any, intervalMinutes);
    
    // Update runtime polling manager
    const manager = getPollingManager();
    if (manager) {
      manager.updateInterval(apiType as any, intervalMinutes);
      console.log(`[IPC] Polling manager updated for ${apiType}`);
    } else {
      console.warn('[IPC] Polling manager not initialized yet');
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('[IPC] Error updating polling interval:', error);
    throw error;
  }
});

/**
 * Enable or disable polling for an API type
 */
ipcMain.handle('twitch-polling:set-enabled', async (_, apiType: string, enabled: boolean) => {
  try {
    console.log(`[IPC] ${enabled ? 'Enabling' : 'Disabling'} polling for ${apiType}`);
    
    // Update database
    pollingConfigRepo.setEnabled(apiType as any, enabled);
    
    // Update runtime polling manager
    const manager = getPollingManager();
    if (manager) {
      manager.setEnabled(apiType as any, enabled);
      console.log(`[IPC] Polling manager ${enabled ? 'enabled' : 'disabled'} for ${apiType}`);
    } else {
      console.warn('[IPC] Polling manager not initialized yet');
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('[IPC] Error setting polling enabled state:', error);
    throw error;
  }
});

/**
 * Get polling manager status
 */
ipcMain.handle('twitch-polling:get-status', async () => {
  try {
    const manager = getPollingManager();
    if (!manager) {
      return [];
    }
    
    return manager.getStatus();
  } catch (error: any) {
    console.error('[IPC] Error getting polling status:', error);
    throw error;
  }
});

console.log('[IPC] Twitch Polling Config handlers registered');
