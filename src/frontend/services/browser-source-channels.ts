const { ipcRenderer } = window.require('electron');

/**
 * Browser Source Channel Configuration
 */
export interface BrowserSourceChannel {
  id: number;
  channel_id: string;
  name: string;
  display_name: string;
  description: string | null;
  color: string;
  icon: string;
  is_default: boolean;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
  action_count?: number;
}

/**
 * Create/Update Browser Source Channel payload
 */
export interface BrowserSourceChannelPayload {
  channel_id: string;
  name: string;
  display_name: string;
  description?: string | null;
  color?: string;
  icon?: string;
  is_default?: boolean;
  is_enabled?: boolean;
}

/**
 * IPC Response format
 */
interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Browser Source Channels Service
 * Manages custom channels for organizing browser source alerts
 */
export const browserSourceChannelsService = {
  /**
   * Get all channels for a Twitch channel
   */
  async getAll(channelId: string): Promise<BrowserSourceChannel[]> {
    const response: IPCResponse<BrowserSourceChannel[]> = await ipcRenderer.invoke(
      'browser-source-channels:get-all',
      channelId
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to get channels');
    }

    return response.data || [];
  },

  /**
   * Get a channel by ID
   */
  async getById(id: number): Promise<BrowserSourceChannel> {
    const response: IPCResponse<BrowserSourceChannel> = await ipcRenderer.invoke(
      'browser-source-channels:get-by-id',
      id
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to get channel');
    }

    if (!response.data) {
      throw new Error('Channel not found');
    }

    return response.data;
  },

  /**
   * Get a channel by name
   */
  async getByName(channelId: string, name: string): Promise<BrowserSourceChannel> {
    const response: IPCResponse<BrowserSourceChannel> = await ipcRenderer.invoke(
      'browser-source-channels:get-by-name',
      channelId,
      name
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to get channel');
    }

    if (!response.data) {
      throw new Error('Channel not found');
    }

    return response.data;
  },

  /**
   * Get or create default channel
   */
  async getDefault(channelId: string): Promise<BrowserSourceChannel> {
    const response: IPCResponse<BrowserSourceChannel> = await ipcRenderer.invoke(
      'browser-source-channels:get-default',
      channelId
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to get default channel');
    }

    if (!response.data) {
      throw new Error('Default channel not found');
    }

    return response.data;
  },

  /**
   * Create a new channel
   */
  async create(payload: BrowserSourceChannelPayload): Promise<BrowserSourceChannel> {
    const response: IPCResponse<BrowserSourceChannel> = await ipcRenderer.invoke(
      'browser-source-channels:create',
      payload
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to create channel');
    }

    if (!response.data) {
      throw new Error('Channel not created');
    }

    return response.data;
  },

  /**
   * Update a channel
   */
  async update(id: number, payload: Partial<BrowserSourceChannelPayload>): Promise<BrowserSourceChannel> {
    const response: IPCResponse<BrowserSourceChannel> = await ipcRenderer.invoke(
      'browser-source-channels:update',
      id,
      payload
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to update channel');
    }

    if (!response.data) {
      throw new Error('Channel not updated');
    }

    return response.data;
  },

  /**
   * Delete a channel
   */
  async delete(id: number): Promise<boolean> {
    const response: IPCResponse<boolean> = await ipcRenderer.invoke(
      'browser-source-channels:delete',
      id
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to delete channel');
    }

    return response.data || false;
  },

  /**
   * Check if a channel name is available
   */
  async checkNameAvailability(channelId: string, name: string, excludeId?: number): Promise<boolean> {
    const response: IPCResponse<boolean> = await ipcRenderer.invoke(
      'browser-source-channels:check-name',
      channelId,
      name,
      excludeId
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to check name availability');
    }

    return response.data || false;
  },

  /**
   * Get action count for a channel
   */
  async getActionCount(channelId: string, channelName: string): Promise<number> {
    const response: IPCResponse<number> = await ipcRenderer.invoke(
      'browser-source-channels:get-action-count',
      channelId,
      channelName
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to get action count');
    }

    return response.data || 0;
  },

  /**
   * Generate browser source URL for a channel
   */
  getBrowserSourceUrl(channelName: string, port: number = 3737): string {
    if (channelName === 'default') {
      return `http://localhost:${port}/browser-source`;
    }
    return `http://localhost:${port}/browser-source?channel=${channelName}`;
  },

  /**
   * Sanitize channel name to be URL-safe
   */
  sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
      .replace(/-+/g, '-'); // Replace multiple hyphens with single
  },

  /**
   * Validate channel name
   */
  validateName(name: string): { valid: boolean; error?: string } {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: 'Channel name is required' };
    }

    if (name.length < 2) {
      return { valid: false, error: 'Channel name must be at least 2 characters' };
    }

    if (name.length > 50) {
      return { valid: false, error: 'Channel name must be less than 50 characters' };
    }

    const urlSafe = /^[a-z0-9-_]+$/;
    if (!urlSafe.test(name)) {
      return { 
        valid: false, 
        error: 'Channel name must contain only lowercase letters, numbers, hyphens, and underscores' 
      };
    }

    // Reserved names
    const reserved = ['default', 'admin', 'api', 'config', 'settings', 'test'];
    if (reserved.includes(name) && name !== 'default') {
      return { valid: false, error: `'${name}' is a reserved channel name` };
    }

    return { valid: true };
  }
};
