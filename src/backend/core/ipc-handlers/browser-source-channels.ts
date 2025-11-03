import { ipcMain } from 'electron';
import { getDatabase } from '../../database/connection';
import { 
  BrowserSourceChannelsRepository, 
  BrowserSourceChannel, 
  BrowserSourceChannelPayload 
} from '../../database/repositories/browser-source-channels';

/**
 * IPC Response format
 */
interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Register IPC handlers for browser source channels
 */
export function registerBrowserSourceChannelHandlers(): void {
  const repository = new BrowserSourceChannelsRepository();

  /**
   * Get all channels for a Twitch channel
   */
  ipcMain.handle(
    'browser-source-channels:get-all',
    async (_, channelId: string): Promise<IPCResponse<BrowserSourceChannel[]>> => {
      try {
        const channels = repository.getAllByChannelId(channelId);
        return { success: true, data: channels };
      } catch (error: any) {
        console.error('[IPC:browser-source-channels:get-all] Error:', error);
        return { success: false, error: error.message };
      }
    }
  );  /**
   * Get a channel by ID
   */
  ipcMain.handle(
    'browser-source-channels:get-by-id',
    async (_, id: number): Promise<IPCResponse<BrowserSourceChannel>> => {
      try {
        const channel = repository.findById(id);
        if (!channel) {
          return { success: false, error: 'Channel not found' };
        }
        return { success: true, data: channel };
      } catch (error: any) {
        console.error('[IPC:browser-source-channels:get-by-id] Error:', error);
        return { success: false, error: error.message };
      }
    }
  );

  /**
   * Get a channel by name
   */
  ipcMain.handle(
    'browser-source-channels:get-by-name',
    async (_, channelId: string, name: string): Promise<IPCResponse<BrowserSourceChannel>> => {
      try {
        const channel = repository.getByName(channelId, name);
        if (!channel) {
          return { success: false, error: 'Channel not found' };
        }
        return { success: true, data: channel };
      } catch (error: any) {
        console.error('[IPC:browser-source-channels:get-by-name] Error:', error);
        return { success: false, error: error.message };
      }
    }
  );

  /**
   * Get default channel
   */
  ipcMain.handle(
    'browser-source-channels:get-default',
    async (_, channelId: string): Promise<IPCResponse<BrowserSourceChannel>> => {
      try {
        const channel = repository.ensureDefaultChannel(channelId);
        return { success: true, data: channel };
      } catch (error: any) {
        console.error('[IPC:browser-source-channels:get-default] Error:', error);
        return { success: false, error: error.message };
      }
    }
  );

  /**
   * Create a new channel
   */
  ipcMain.handle(
    'browser-source-channels:create',
    async (_, payload: BrowserSourceChannelPayload): Promise<IPCResponse<BrowserSourceChannel>> => {
      try {
        // Validate name is URL-safe
        const urlSafeName = payload.name.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
        if (urlSafeName !== payload.name) {
          return { 
            success: false, 
            error: 'Channel name must be URL-safe (lowercase letters, numbers, hyphens, underscores only)' 
          };
        }

        // Check if name is available
        if (!repository.isNameAvailable(payload.channel_id, payload.name)) {
          return { success: false, error: 'Channel name already exists' };
        }

        const channel = repository.create(payload);
        return { success: true, data: channel };
      } catch (error: any) {
        console.error('[IPC:browser-source-channels:create] Error:', error);
        return { success: false, error: error.message };
      }
    }
  );
  /**
   * Update a channel
   */
  ipcMain.handle(
    'browser-source-channels:update',
    async (_, id: number, payload: Partial<BrowserSourceChannelPayload>): Promise<IPCResponse<BrowserSourceChannel>> => {
      try {
        // If updating name, validate it's URL-safe
        if (payload.name) {
          const urlSafeName = payload.name.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
          if (urlSafeName !== payload.name) {
            return { 
              success: false, 
              error: 'Channel name must be URL-safe (lowercase letters, numbers, hyphens, underscores only)' 
            };
          }

          // Check if name is available (excluding current channel)
          const channel = repository.findById(id);
          if (channel && !repository.isNameAvailable(channel.channel_id, payload.name, id)) {
            return { success: false, error: 'Channel name already exists' };
          }
        }

        const channel = repository.updateById(id, payload);
        return { success: true, data: channel };
      } catch (error: any) {
        console.error('[IPC:browser-source-channels:update] Error:', error);
        return { success: false, error: error.message };
      }
    }
  );

  /**
   * Delete a channel
   */
  ipcMain.handle(
    'browser-source-channels:delete',
    async (_, id: number): Promise<IPCResponse<boolean>> => {
      try {
        const result = repository.removeChannel(id);
        return { success: true, data: result };
      } catch (error: any) {
        console.error('[IPC:browser-source-channels:delete] Error:', error);
        return { success: false, error: error.message };
      }
    }
  );

  /**
   * Check if a name is available
   */
  ipcMain.handle(
    'browser-source-channels:check-name',
    async (_, channelId: string, name: string, excludeId?: number): Promise<IPCResponse<boolean>> => {
      try {
        const isAvailable = repository.isNameAvailable(channelId, name, excludeId);
        return { success: true, data: isAvailable };
      } catch (error: any) {
        console.error('[IPC:browser-source-channels:check-name] Error:', error);
        return { success: false, error: error.message };
      }
    }
  );

  /**
   * Get action count for a channel
   */
  ipcMain.handle(
    'browser-source-channels:get-action-count',
    async (_, channelId: string, channelName: string): Promise<IPCResponse<number>> => {
      try {
        const count = repository.getActionCount(channelId, channelName);
        return { success: true, data: count };
      } catch (error: any) {
        console.error('[IPC:browser-source-channels:get-action-count] Error:', error);
        return { success: false, error: error.message };
      }
    }
  );

  console.log('[IPC] Browser Source Channel handlers registered (8 handlers)');
}
