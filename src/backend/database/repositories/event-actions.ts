import { BaseRepository } from '../base-repository';

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
 * Repository for Event Actions
 * Manages customizable alerts for Twitch events
 */
export class EventActionsRepository extends BaseRepository<EventAction> {
  get tableName(): string {
    return 'event_actions';
  }

  /**
   * Create a new event action
   */
  create(payload: EventActionPayload): EventAction {
    const db = this.getDatabase();
    
    const stmt = db.prepare(`
      INSERT INTO event_actions (
        channel_id, event_type, is_enabled,
        text_enabled, text_template, text_duration, text_position, text_style,
        sound_enabled, sound_file_path, sound_volume,
        image_enabled, image_file_path, image_duration, image_position, image_width, image_height,
        video_enabled, video_file_path, video_volume, video_position, video_width, video_height
      ) VALUES (
        @channel_id, @event_type, @is_enabled,
        @text_enabled, @text_template, @text_duration, @text_position, @text_style,
        @sound_enabled, @sound_file_path, @sound_volume,
        @image_enabled, @image_file_path, @image_duration, @image_position, @image_width, @image_height,
        @video_enabled, @video_file_path, @video_volume, @video_position, @video_width, @video_height
      )
    `);

    const result = stmt.run({
      channel_id: payload.channel_id,
      event_type: payload.event_type,
      is_enabled: payload.is_enabled !== undefined ? (payload.is_enabled ? 1 : 0) : 1,
      
      text_enabled: payload.text_enabled ? 1 : 0,
      text_template: payload.text_template || null,
      text_duration: payload.text_duration || 5000,
      text_position: payload.text_position || 'top-center',
      text_style: payload.text_style || null,
      
      sound_enabled: payload.sound_enabled ? 1 : 0,
      sound_file_path: payload.sound_file_path || null,
      sound_volume: payload.sound_volume !== undefined ? payload.sound_volume : 1.0,
      
      image_enabled: payload.image_enabled ? 1 : 0,
      image_file_path: payload.image_file_path || null,
      image_duration: payload.image_duration || 5000,
      image_position: payload.image_position || 'center',
      image_width: payload.image_width || null,
      image_height: payload.image_height || null,
      
      video_enabled: payload.video_enabled ? 1 : 0,
      video_file_path: payload.video_file_path || null,
      video_volume: payload.video_volume !== undefined ? payload.video_volume : 1.0,
      video_position: payload.video_position || 'center',
      video_width: payload.video_width || null,
      video_height: payload.video_height || null,
    });

    const action = this.getById(result.lastInsertRowid as number);
    if (!action) {
      throw new Error('Failed to create event action');
    }

    return action;
  }
  /**
   * Update an existing event action by ID
   */
  updateById(id: number, payload: Partial<EventActionPayload>): EventAction {
    const db = this.getDatabase();
    
    const updates: string[] = [];
    const params: any = { id };

    if (payload.is_enabled !== undefined) {
      updates.push('is_enabled = @is_enabled');
      params.is_enabled = payload.is_enabled ? 1 : 0;
    }
    
    if (payload.text_enabled !== undefined) {
      updates.push('text_enabled = @text_enabled');
      params.text_enabled = payload.text_enabled ? 1 : 0;
    }
    if (payload.text_template !== undefined) {
      updates.push('text_template = @text_template');
      params.text_template = payload.text_template;
    }
    if (payload.text_duration !== undefined) {
      updates.push('text_duration = @text_duration');
      params.text_duration = payload.text_duration;
    }
    if (payload.text_position !== undefined) {
      updates.push('text_position = @text_position');
      params.text_position = payload.text_position;
    }
    if (payload.text_style !== undefined) {
      updates.push('text_style = @text_style');
      params.text_style = payload.text_style;
    }
    
    if (payload.sound_enabled !== undefined) {
      updates.push('sound_enabled = @sound_enabled');
      params.sound_enabled = payload.sound_enabled ? 1 : 0;
    }
    if (payload.sound_file_path !== undefined) {
      updates.push('sound_file_path = @sound_file_path');
      params.sound_file_path = payload.sound_file_path;
    }
    if (payload.sound_volume !== undefined) {
      updates.push('sound_volume = @sound_volume');
      params.sound_volume = payload.sound_volume;
    }
    
    if (payload.image_enabled !== undefined) {
      updates.push('image_enabled = @image_enabled');
      params.image_enabled = payload.image_enabled ? 1 : 0;
    }
    if (payload.image_file_path !== undefined) {
      updates.push('image_file_path = @image_file_path');
      params.image_file_path = payload.image_file_path;
    }
    if (payload.image_duration !== undefined) {
      updates.push('image_duration = @image_duration');
      params.image_duration = payload.image_duration;
    }
    if (payload.image_position !== undefined) {
      updates.push('image_position = @image_position');
      params.image_position = payload.image_position;
    }
    if (payload.image_width !== undefined) {
      updates.push('image_width = @image_width');
      params.image_width = payload.image_width;
    }
    if (payload.image_height !== undefined) {
      updates.push('image_height = @image_height');
      params.image_height = payload.image_height;
    }
    
    if (payload.video_enabled !== undefined) {
      updates.push('video_enabled = @video_enabled');
      params.video_enabled = payload.video_enabled ? 1 : 0;
    }
    if (payload.video_file_path !== undefined) {
      updates.push('video_file_path = @video_file_path');
      params.video_file_path = payload.video_file_path;
    }
    if (payload.video_volume !== undefined) {
      updates.push('video_volume = @video_volume');
      params.video_volume = payload.video_volume;
    }
    if (payload.video_position !== undefined) {
      updates.push('video_position = @video_position');
      params.video_position = payload.video_position;
    }
    if (payload.video_width !== undefined) {
      updates.push('video_width = @video_width');
      params.video_width = payload.video_width;
    }
    if (payload.video_height !== undefined) {
      updates.push('video_height = @video_height');
      params.video_height = payload.video_height;
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    const stmt = db.prepare(`
      UPDATE event_actions 
      SET ${updates.join(', ')}
      WHERE id = @id
    `);

    stmt.run(params);

    const action = this.getById(id);
    if (!action) {
      throw new Error('Failed to update event action');
    }

    return action;
  }

  /**
   * Get action by ID
   */
  getById(id: number): EventAction | null {
    return super.getById(id);
  }

  /**
   * Get all actions for a channel
   */
  getByChannelId(channelId: string): EventAction[] {
    const db = this.getDatabase();
    return db.prepare(`
      SELECT * FROM event_actions 
      WHERE channel_id = ?
      ORDER BY event_type
    `).all(channelId) as EventAction[];
  }

  /**
   * Get action for a specific event type on a channel
   */
  getByEventType(channelId: string, eventType: string): EventAction | null {
    const db = this.getDatabase();
    const row = db.prepare(`
      SELECT * FROM event_actions 
      WHERE channel_id = ? AND event_type = ?
      LIMIT 1
    `).get(channelId, eventType) as EventAction | undefined;
    
    return row || null;
  }

  /**
   * Get all enabled actions for a channel
   */
  getEnabledByChannelId(channelId: string): EventAction[] {
    const db = this.getDatabase();
    return db.prepare(`
      SELECT * FROM event_actions 
      WHERE channel_id = ? AND is_enabled = 1
      ORDER BY event_type
    `).all(channelId) as EventAction[];
  }  /**
   * Delete an action by ID
   */
  removeById(id: number): void {
    const db = this.getDatabase();
    db.prepare(`
      DELETE FROM event_actions WHERE id = ?
    `).run(id);
  }

  /**
   * Delete action for specific event type on a channel
   */
  deleteByEventType(channelId: string, eventType: string): void {
    const db = this.getDatabase();
    db.prepare(`
      DELETE FROM event_actions 
      WHERE channel_id = ? AND event_type = ?
    `).run(channelId, eventType);
  }

  /**
   * Delete all actions for a channel
   */
  deleteByChannelId(channelId: string): void {
    const db = this.getDatabase();
    db.prepare(`
      DELETE FROM event_actions WHERE channel_id = ?
    `).run(channelId);
  }
  /**
   * Check if an action exists for a specific event type
   */
  actionExists(channelId: string, eventType: string): boolean {
    const db = this.getDatabase();
    const row = db.prepare(`
      SELECT 1 FROM event_actions 
      WHERE channel_id = ? AND event_type = ?
      LIMIT 1
    `).get(channelId, eventType);
    
    return !!row;
  }
  /**
   * Create or update an action (upsert)
   */
  upsertAction(payload: EventActionPayload): EventAction {
    const existing = this.getByEventType(payload.channel_id, payload.event_type);
    
    if (existing) {
      return this.updateById(existing.id, payload);
    } else {
      return this.create(payload);
    }
  }

  /**
   * Get count of actions for a channel
   */
  getCountByChannelId(channelId: string): number {
    const db = this.getDatabase();
    const row = db.prepare(`
      SELECT COUNT(*) as count FROM event_actions 
      WHERE channel_id = ?
    `).get(channelId) as { count: number };
    
    return row.count;
  }

  /**
   * Get count of enabled actions for a channel
   */
  getEnabledCountByChannelId(channelId: string): number {
    const db = this.getDatabase();
    const row = db.prepare(`
      SELECT COUNT(*) as count FROM event_actions 
      WHERE channel_id = ? AND is_enabled = 1
    `).get(channelId) as { count: number };
    
    return row.count;
  }
}
