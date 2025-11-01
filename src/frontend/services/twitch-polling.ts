/**
 * Twitch Polling Config Frontend Service
 * 
 * Provides frontend access to Twitch API polling configuration.
 */

const { ipcRenderer } = window.require('electron');

export type ApiType = 'role_sync' | 'followers';
export type IntervalUnit = 'seconds' | 'minutes' | 'hours';

export interface PollingConfig {
  api_type: ApiType;
  interval_value: number;
  min_interval: number;
  max_interval: number;
  interval_units: IntervalUnit;
  step: number;
  enabled: boolean;
  last_poll_at: string | null;
  description: string | null;
  isRunning: boolean;
}

export interface PollingStatus {
  apiType: ApiType;
  enabled: boolean;
  intervalValue: number;
  intervalUnits: IntervalUnit;
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
export async function getPollingConfig(apiType: ApiType): Promise<PollingConfig> {
  return await ipcRenderer.invoke('twitch-polling:get-config', apiType);
}

/**
 * Update polling interval for an API type
 */
export async function updatePollingInterval(
  apiType: ApiType,
  intervalValue: number
): Promise<{ success: boolean }> {
  return await ipcRenderer.invoke('twitch-polling:update-interval', apiType, intervalValue);
}

/**
 * Enable or disable polling for an API type
 */
export async function setPollingEnabled(
  apiType: ApiType,
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
