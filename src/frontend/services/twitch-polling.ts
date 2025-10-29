/**
 * Twitch Polling Config Frontend Service
 * 
 * Provides frontend access to Twitch API polling configuration.
 */

const { ipcRenderer } = window.require('electron');

export interface PollingConfig {
  api_type: 'role_sync';
  interval_minutes: number;
  enabled: boolean;
  last_poll_at: string | null;
  description: string | null;
  isRunning: boolean;
}

export interface PollingStatus {
  apiType: string;
  enabled: boolean;
  intervalMinutes: number;
  lastPollAt: string | null;
  isRunning: boolean;
}

/**
 * Get all polling configurations
 */
export async function getAllPollingConfigs(): Promise<PollingConfig[]> {
  return await ipcRenderer.invoke('twitch-polling:get-all-configs');
}

/**
 * Get specific polling configuration
 */
export async function getPollingConfig(apiType: string): Promise<PollingConfig> {
  return await ipcRenderer.invoke('twitch-polling:get-config', apiType);
}

/**
 * Update polling interval for an API type
 */
export async function updatePollingInterval(
  apiType: string,
  intervalMinutes: number
): Promise<{ success: boolean }> {
  return await ipcRenderer.invoke('twitch-polling:update-interval', apiType, intervalMinutes);
}

/**
 * Enable or disable polling for an API type
 */
export async function setPollingEnabled(
  apiType: string,
  enabled: boolean
): Promise<{ success: boolean }> {
  return await ipcRenderer.invoke('twitch-polling:set-enabled', apiType, enabled);
}

/**
 * Get polling manager status
 */
export async function getPollingStatus(): Promise<PollingStatus[]> {
  return await ipcRenderer.invoke('twitch-polling:get-status');
}
