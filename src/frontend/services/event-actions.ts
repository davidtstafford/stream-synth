/**
 * Event Actions Service
 * 
 * Frontend service wrapper for Event Actions IPC handlers.
 * Provides type-safe API for React components with automatic error handling.
 * 
 * Phase 6: Frontend Service Wrapper
 */

import { ipcClient } from './ipc-client';

/**
 * Event Action Configuration
 * Defines what happens when a specific event type triggers
 */
export interface EventAction {
  id: number;
  channel_id: string;
  event_type: string;
  is_enabled: boolean;
  
  // Text Configuration
  text_enabled: boolean;
  text_template: string | null;
  text_duration: number;
  text_position: string;
  text_style: string | null;
  
  // Sound Configuration
  sound_enabled: boolean;
  sound_file_path: string | null;
  sound_volume: number;
  
  // Image Configuration
  image_enabled: boolean;
  image_file_path: string | null;
  image_duration: number;
  image_position: string;
  image_width: number | null;
  image_height: number | null;
  
  // Video Configuration
  video_enabled: boolean;
  video_file_path: string | null;
  video_volume: number;
  video_position: string;
  video_width: number | null;
  video_height: number | null;
  
  // Metadata
  created_at: string;
  updated_at: string;
}

/**
 * Create/Update Event Action payload
 */
export interface EventActionPayload {
  channel_id: string;
  event_type: string;
  is_enabled?: boolean;
  
  // Text Configuration
  text_enabled?: boolean;
  text_template?: string | null;
  text_duration?: number;
  text_position?: string;
  text_style?: string | null;
  
  // Sound Configuration
  sound_enabled?: boolean;
  sound_file_path?: string | null;
  sound_volume?: number;
  
  // Image Configuration
  image_enabled?: boolean;
  image_file_path?: string | null;
  image_duration?: number;
  image_position?: string;
  image_width?: number | null;
  image_height?: number | null;
  
  // Video Configuration
  video_enabled?: boolean;
  video_file_path?: string | null;
  video_volume?: number;
  video_position?: string;
  video_width?: number | null;
  video_height?: number | null;
}

/**
 * Alert payload for testing/preview
 */
export interface AlertPayload {
  event_type: string;
  channel_id: string;
  
  // Formatted event
  formatted: {
    html: string;
    plainText: string;
    emoji: string;
    variables: Record<string, any>;
  };
  
  // Text alert
  text?: {
    content: string;
    duration: number;
    position: string;
    style?: any;
  };
  
  // Sound alert
  sound?: {
    file_path: string;
    volume: number;
  };
  
  // Image alert
  image?: {
    file_path: string;
    duration: number;
    position: string;
    width?: number;
    height?: number;
  };
  
  // Video alert
  video?: {
    file_path: string;
    volume: number;
    position: string;
    width?: number;
    height?: number;
  };
  
  timestamp: string;
}

/**
 * Event data for processing through the pipeline
 */
export interface ProcessEventPayload {
  event_type: string;
  event_data: any;
  channel_id: string;
  viewer_username?: string;
  viewer_display_name?: string;
}

/**
 * Browser source server statistics
 */
export interface BrowserSourceStats {
  isRunning: boolean;
  port: number;
  connectedClients: number;
  alertsSent: number;
  url: string;
}

/**
 * Action statistics for a channel
 */
export interface ActionStats {
  total: number;
  enabled: number;
}

/**
 * Event Actions Service
 * Type-safe wrapper for Event Actions IPC handlers
 */
export class EventActionsService {
  
  // ===== CRUD Operations =====
  
  /**
   * Create a new event action
   */
  async createAction(payload: EventActionPayload): Promise<EventAction> {
    return await ipcClient.invoke<EventAction>('event-actions:create', payload);
  }
  
  /**
   * Update an existing event action by ID
   */
  async updateAction(id: number, payload: Partial<EventActionPayload>): Promise<EventAction> {
    return await ipcClient.invoke<EventAction>('event-actions:update', { id, payload });
  }
  
  /**
   * Create or update an event action (upsert)
   * If action exists for channel + event type, updates it. Otherwise creates new.
   */
  async upsertAction(payload: EventActionPayload): Promise<EventAction> {
    return await ipcClient.invoke<EventAction>('event-actions:upsert', payload);
  }
  
  /**
   * Delete an event action by ID
   */
  async deleteAction(id: number): Promise<void> {
    await ipcClient.invoke<{ success: boolean }>('event-actions:delete', id);
  }
  
  /**
   * Delete an event action by channel and event type
   */
  async deleteActionByType(channelId: string, eventType: string): Promise<void> {
    await ipcClient.invoke<{ success: boolean }>('event-actions:delete-by-type', {
      channel_id: channelId,
      event_type: eventType
    });
  }
  
  // ===== Query Operations =====
  
  /**
   * Get a single event action by ID
   */
  async getActionById(id: number): Promise<EventAction | null> {
    return await ipcClient.invoke<EventAction | null>('event-actions:get-by-id', id);
  }
  
  /**
   * Get event action by channel and event type
   */
  async getActionByType(channelId: string, eventType: string): Promise<EventAction | null> {
    return await ipcClient.invoke<EventAction | null>('event-actions:get-by-type', {
      channel_id: channelId,
      event_type: eventType
    });
  }
  
  /**
   * Get all event actions for a channel
   */
  async getAllActions(channelId: string): Promise<EventAction[]> {
    return await ipcClient.invoke<EventAction[]>('event-actions:get-all', channelId);
  }
  
  /**
   * Get only enabled event actions for a channel
   */
  async getEnabledActions(channelId: string): Promise<EventAction[]> {
    return await ipcClient.invoke<EventAction[]>('event-actions:get-enabled', channelId);
  }
  
  /**
   * Get action statistics (total count, enabled count)
   */
  async getStats(channelId: string): Promise<ActionStats> {
    return await ipcClient.invoke<ActionStats>('event-actions:get-stats', channelId);
  }
  
  /**
   * Check if an action exists for a specific event type
   */
  async actionExists(channelId: string, eventType: string): Promise<boolean> {
    return await ipcClient.invoke<boolean>('event-actions:exists', {
      channel_id: channelId,
      event_type: eventType
    });
  }
  
  // ===== Testing & Preview =====
  
  /**
   * Send a test alert to browser source
   * Use this for previewing alerts without processing through the full pipeline
   */
  async testAlert(payload: AlertPayload): Promise<void> {
    const result = await ipcClient.invoke<{ success: boolean; message: string }>(
      'event-actions:test-alert',
      payload
    );
    
    if (!result.success) {
      throw new Error(result.message);
    }
  }
  
  /**
   * Process an event through the full action pipeline
   * This will look up the action, format the event, and send to browser source
   */
  async processEvent(payload: ProcessEventPayload): Promise<void> {
    const result = await ipcClient.invoke<{ success: boolean; message: string }>(
      'event-actions:process-event',
      payload
    );
    
    if (!result.success) {
      throw new Error(result.message);
    }
  }
  
  // ===== Browser Source Integration =====
  
  /**
   * Get browser source server statistics
   */
  async getBrowserSourceStats(): Promise<BrowserSourceStats | null> {
    return await ipcClient.invoke<BrowserSourceStats | null>('browser-source:get-stats');
  }
  
  /**
   * Get list of connected browser source client IDs
   */
  async getConnectedClients(): Promise<string[]> {
    return await ipcClient.invoke<string[]>('browser-source:get-clients');
  }
  
  /**
   * Send a custom alert to all connected browser sources
   */
  async sendCustomAlert(payload: AlertPayload): Promise<void> {
    const result = await ipcClient.invoke<{ success: boolean; message: string }>(
      'browser-source:send-alert',
      payload
    );
    
    if (!result.success) {
      throw new Error(result.message);
    }
  }
  
  // ===== Helper Methods =====
  
  /**
   * Toggle an action's enabled state
   */
  async toggleAction(id: number, enabled: boolean): Promise<EventAction> {
    return await this.updateAction(id, { is_enabled: enabled });
  }
  
  /**
   * Enable a specific media type for an action
   */
  async enableMediaType(
    id: number,
    mediaType: 'text' | 'sound' | 'image' | 'video',
    enabled: boolean
  ): Promise<EventAction> {
    const key = `${mediaType}_enabled` as keyof Partial<EventActionPayload>;
    return await this.updateAction(id, { [key]: enabled });
  }
  
  /**
   * Update text configuration for an action
   */
  async updateTextConfig(
    id: number,
    config: {
      template?: string;
      duration?: number;
      position?: string;
      style?: string;
    }
  ): Promise<EventAction> {
    return await this.updateAction(id, {
      text_template: config.template,
      text_duration: config.duration,
      text_position: config.position,
      text_style: config.style
    });
  }
  
  /**
   * Update sound configuration for an action
   */
  async updateSoundConfig(
    id: number,
    config: {
      filePath?: string;
      volume?: number;
    }
  ): Promise<EventAction> {
    return await this.updateAction(id, {
      sound_file_path: config.filePath,
      sound_volume: config.volume
    });
  }
  
  /**
   * Update image configuration for an action
   */
  async updateImageConfig(
    id: number,
    config: {
      filePath?: string;
      duration?: number;
      position?: string;
      width?: number;
      height?: number;
    }
  ): Promise<EventAction> {
    return await this.updateAction(id, {
      image_file_path: config.filePath,
      image_duration: config.duration,
      image_position: config.position,
      image_width: config.width,
      image_height: config.height
    });
  }
  
  /**
   * Update video configuration for an action
   */
  async updateVideoConfig(
    id: number,
    config: {
      filePath?: string;
      volume?: number;
      position?: string;
      width?: number;
      height?: number;
    }
  ): Promise<EventAction> {
    return await this.updateAction(id, {
      video_file_path: config.filePath,
      video_volume: config.volume,
      video_position: config.position,
      video_width: config.width,
      video_height: config.height
    });
  }
  
  /**
   * Get default action payload for creating new actions
   */
  getDefaultPayload(channelId: string, eventType: string): EventActionPayload {
    return {
      channel_id: channelId,
      event_type: eventType,
      is_enabled: true,
      
      // Text defaults
      text_enabled: true,
      text_template: null,
      text_duration: 5000,
      text_position: 'top-center',
      text_style: null,
      
      // Sound defaults
      sound_enabled: false,
      sound_file_path: null,
      sound_volume: 1.0,
      
      // Image defaults
      image_enabled: false,
      image_file_path: null,
      image_duration: 5000,
      image_position: 'middle-center',
      image_width: null,
      image_height: null,
      
      // Video defaults
      video_enabled: false,
      video_file_path: null,
      video_volume: 1.0,
      video_position: 'middle-center',
      video_width: null,
      video_height: null
    };
  }
}

// Export singleton instance
export const eventActionsService = new EventActionsService();

// Export default for convenience
export default eventActionsService;
