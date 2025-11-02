/**
 * Event Actions IPC Handlers
 * 
 * Handles all event action operations via IPC using centralized IPC Framework:
 * - Create/Update/Delete event actions
 * - Get all event actions for a channel
 * - Get specific event action
 * - Test alert functionality
 * - Get browser source server stats
 * 
 * Phase 5: Event Actions Feature - IPC Handlers
 */

import { ipcRegistry } from '../ipc/ipc-framework';
import { EventActionsRepository, EventAction, EventActionPayload } from '../../database/repositories/event-actions';
import { getEventActionProcessor } from '../../main';
import { getBrowserSourceServer } from '../../main';
import { AlertPayload } from '../../services/event-action-processor';

// Initialize repository with lazy getter
let eventActionsRepoInstance: EventActionsRepository | null = null;
const getEventActionsRepo = () => eventActionsRepoInstance ??= new EventActionsRepository();

/**
 * Setup all event action IPC handlers
 */
export function setupEventActionHandlers(): void {
  
  // ===== Event Actions: Create =====
  ipcRegistry.register<EventActionPayload, EventAction>(
    'event-actions:create',
    {
      validate: (payload) => {
        if (!payload.channel_id) return 'channel_id is required';
        if (!payload.event_type) return 'event_type is required';
        return null;
      },
      execute: async (payload) => {
        console.log('[IPC] Creating event action:', payload.event_type);
        return getEventActionsRepo().create(payload);
      }
    }
  );

  // ===== Event Actions: Update =====
  ipcRegistry.register<{ id: number; payload: Partial<EventActionPayload> }, EventAction>(
    'event-actions:update',
    {
      validate: (input) => {
        if (!input.id) return 'id is required';
        if (!input.payload) return 'payload is required';
        return null;
      },
      execute: async (input) => {
        console.log('[IPC] Updating event action:', input.id);
        return getEventActionsRepo().updateById(input.id, input.payload);
      }
    }
  );

  // ===== Event Actions: Upsert =====
  ipcRegistry.register<EventActionPayload, EventAction>(
    'event-actions:upsert',
    {
      validate: (payload) => {
        if (!payload.channel_id) return 'channel_id is required';
        if (!payload.event_type) return 'event_type is required';
        return null;
      },
      execute: async (payload) => {
        console.log('[IPC] Upserting event action:', payload.event_type);
        return getEventActionsRepo().upsertAction(payload);
      }
    }
  );

  // ===== Event Actions: Delete by ID =====
  ipcRegistry.register<number, { success: boolean }>(
    'event-actions:delete',
    {
      validate: (id) => {
        if (!id) return 'id is required';
        return null;
      },
      execute: async (id) => {
        console.log('[IPC] Deleting event action:', id);
        getEventActionsRepo().removeById(id);
        return { success: true };
      }
    }
  );

  // ===== Event Actions: Delete by Event Type =====
  ipcRegistry.register<{ channel_id: string; event_type: string }, { success: boolean }>(
    'event-actions:delete-by-type',
    {
      validate: (input) => {
        if (!input.channel_id) return 'channel_id is required';
        if (!input.event_type) return 'event_type is required';
        return null;
      },
      execute: async (input) => {
        console.log('[IPC] Deleting event action by type:', input.event_type);
        getEventActionsRepo().deleteByEventType(input.channel_id, input.event_type);
        return { success: true };
      }
    }
  );

  // ===== Event Actions: Get by ID =====
  ipcRegistry.register<number, EventAction | null>(
    'event-actions:get-by-id',
    {
      validate: (id) => {
        if (!id) return 'id is required';
        return null;
      },
      execute: async (id) => {
        return getEventActionsRepo().getById(id);
      }
    }
  );

  // ===== Event Actions: Get by Event Type =====
  ipcRegistry.register<{ channel_id: string; event_type: string }, EventAction | null>(
    'event-actions:get-by-type',
    {
      validate: (input) => {
        if (!input.channel_id) return 'channel_id is required';
        if (!input.event_type) return 'event_type is required';
        return null;
      },
      execute: async (input) => {
        return getEventActionsRepo().getByEventType(input.channel_id, input.event_type);
      }
    }
  );

  // ===== Event Actions: Get All for Channel =====
  ipcRegistry.register<string, EventAction[]>(
    'event-actions:get-all',
    {
      validate: (channelId) => {
        if (!channelId) return 'channel_id is required';
        return null;
      },
      execute: async (channelId) => {
        return getEventActionsRepo().getByChannelId(channelId);
      }
    }
  );

  // ===== Event Actions: Get Enabled for Channel =====
  ipcRegistry.register<string, EventAction[]>(
    'event-actions:get-enabled',
    {
      validate: (channelId) => {
        if (!channelId) return 'channel_id is required';
        return null;
      },
      execute: async (channelId) => {
        return getEventActionsRepo().getEnabledByChannelId(channelId);
      }
    }
  );

  // ===== Event Actions: Get Stats for Channel =====
  ipcRegistry.register<string, { total: number; enabled: number }>(
    'event-actions:get-stats',
    {
      validate: (channelId) => {
        if (!channelId) return 'channel_id is required';
        return null;
      },
      execute: async (channelId) => {
        const total = getEventActionsRepo().getCountByChannelId(channelId);
        const enabled = getEventActionsRepo().getEnabledCountByChannelId(channelId);
        return { total, enabled };
      }
    }
  );

  // ===== Event Actions: Check if Exists =====
  ipcRegistry.register<{ channel_id: string; event_type: string }, boolean>(
    'event-actions:exists',
    {
      validate: (input) => {
        if (!input.channel_id) return 'channel_id is required';
        if (!input.event_type) return 'event_type is required';
        return null;
      },
      execute: async (input) => {
        return getEventActionsRepo().actionExists(input.channel_id, input.event_type);
      }
    }
  );

  // ===== Event Actions: Test Alert =====
  ipcRegistry.register<AlertPayload, { success: boolean; message: string }>(
    'event-actions:test-alert',
    {
      validate: (payload) => {
        if (!payload.event_type) return 'event_type is required';
        if (!payload.channel_id) return 'channel_id is required';
        return null;
      },
      execute: async (payload) => {
        console.log('[IPC] Testing alert:', payload.event_type);
        
        const browserSourceServer = getBrowserSourceServer();
        
        if (!browserSourceServer) {
          return {
            success: false,
            message: 'Browser source server not initialized'
          };
        }
        
        if (!browserSourceServer.isRunning()) {
          return {
            success: false,
            message: 'Browser source server not running'
          };
        }
        
        // Send alert to browser source
        browserSourceServer.sendAlert(payload);
        
        return {
          success: true,
          message: 'Test alert sent to browser source'
        };
      }
    }
  );

  // ===== Event Actions: Process Event (for testing) =====
  ipcRegistry.register<{
    event_type: string;
    event_data: any;
    channel_id: string;
    viewer_username?: string;
    viewer_display_name?: string;
  }, { success: boolean; message: string }>(
    'event-actions:process-event',
    {
      validate: (input) => {
        if (!input.event_type) return 'event_type is required';
        if (!input.channel_id) return 'channel_id is required';
        return null;
      },
      execute: async (input) => {
        console.log('[IPC] Processing event for action:', input.event_type);
        
        const processor = getEventActionProcessor();
        
        if (!processor) {
          return {
            success: false,
            message: 'Event action processor not initialized'
          };
        }
        
        // Process the event through the full pipeline
        await processor.processEvent({
          event_type: input.event_type,
          event_data: input.event_data,
          channel_id: input.channel_id,
          viewer_username: input.viewer_username,
          viewer_display_name: input.viewer_display_name,
          created_at: new Date().toISOString()
        });
        
        return {
          success: true,
          message: 'Event processed through action pipeline'
        };
      }
    }
  );

  // ===== Browser Source: Get Stats =====
  ipcRegistry.register<void, {
    isRunning: boolean;
    port: number;
    connectedClients: number;
    alertsSent: number;
    url: string;
  } | null>(
    'browser-source:get-stats',
    {
      execute: async () => {
        const browserSourceServer = getBrowserSourceServer();
        
        if (!browserSourceServer) {
          return null;
        }
        
        return browserSourceServer.getStats();
      }
    }
  );

  // ===== Browser Source: Get Connected Clients =====
  ipcRegistry.register<void, string[]>(
    'browser-source:get-clients',
    {
      execute: async () => {
        const browserSourceServer = getBrowserSourceServer();
        
        if (!browserSourceServer) {
          return [];
        }
        
        return browserSourceServer.getConnectedClients();
      }
    }
  );

  // ===== Browser Source: Send Custom Alert =====
  ipcRegistry.register<AlertPayload, { success: boolean; message: string }>(
    'browser-source:send-alert',
    {
      validate: (payload) => {
        if (!payload.event_type) return 'event_type is required';
        if (!payload.channel_id) return 'channel_id is required';
        return null;
      },
      execute: async (payload) => {
        console.log('[IPC] Sending custom alert to browser source:', payload.event_type);
        
        const browserSourceServer = getBrowserSourceServer();
        
        if (!browserSourceServer) {
          return {
            success: false,
            message: 'Browser source server not initialized'
          };
        }
        
        if (!browserSourceServer.isRunning()) {
          return {
            success: false,
            message: 'Browser source server not running'
          };
        }
        
        browserSourceServer.sendAlert(payload);
        
        return {
          success: true,
          message: 'Alert sent to all connected browser sources'
        };
      }
    }
  );

  console.log('[IPC] Event Action handlers registered');
}
