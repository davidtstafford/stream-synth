/**
 * Chat Commands Service
 * Wrapper for chat command IPC handlers
 */

const { ipcRenderer } = window.require('electron');

export interface ChatCommandConfig {
  id: number;
  command_name: string;
  command_prefix: string;
  enabled: boolean;
  permission_level: 'viewer' | 'moderator' | 'broadcaster';
  rate_limit_seconds: number;
  custom_response: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatCommandUsage {
  id: number;
  command_name: string;
  viewer_id: string;
  viewer_username: string;
  executed_at: string;
  success: boolean;
  error_message: string | null;
}

export interface ChatCommandUpdate {
  command_prefix?: string;
  enabled?: boolean;
  permission_level?: 'viewer' | 'moderator' | 'broadcaster';
  rate_limit_seconds?: number;
  custom_response?: string | null;
}

/**
 * Get all chat command configurations
 */
export async function getAllCommands(): Promise<{ success: boolean; data?: ChatCommandConfig[]; error?: string }> {
  return await ipcRenderer.invoke('chat-commands:get-all');
}

/**
 * Update a chat command configuration
 */
export async function updateCommand(
  commandName: string,
  updates: ChatCommandUpdate
): Promise<{ success: boolean; error?: string }> {
  return await ipcRenderer.invoke('chat-commands:update', { commandName, updates });
}

/**
 * Get usage statistics for a command
 */
export async function getUsageStats(
  commandName?: string,
  limit?: number
): Promise<{ success: boolean; data?: ChatCommandUsage[]; error?: string }> {
  return await ipcRenderer.invoke('chat-commands:get-usage-stats', { commandName, limit });
}

// Ensure this file is treated as a module
export {};
