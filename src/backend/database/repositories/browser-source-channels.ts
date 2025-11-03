import { BaseRepository } from '../base-repository';

/**
 * Browser Source Channel Configuration
 * Defines named channels for organizing browser source alerts
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
  action_count?: number; // Computed field - how many actions assigned
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
 * Repository for Browser Source Channels
 * Manages custom channels for organizing browser source alerts
 */
export class BrowserSourceChannelsRepository extends BaseRepository<BrowserSourceChannel> {
  get tableName(): string {
    return 'browser_source_channels';
  }

  /**
   * Get a channel by ID (public wrapper)
   */
  findById(id: number): BrowserSourceChannel | null {
    return this.getById(id);
  }

  /**
   * Create a new browser source channel
   */
  create(payload: BrowserSourceChannelPayload): BrowserSourceChannel {
    const db = this.getDatabase();
    
    const stmt = db.prepare(`
      INSERT INTO ${this.tableName} (
        channel_id, name, display_name, description, color, icon, 
        is_default, is_enabled, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    const result = stmt.run(
      payload.channel_id,
      payload.name,
      payload.display_name,
      payload.description || null,
      payload.color || '#9147ff',
      payload.icon || '📺',
      payload.is_default ? 1 : 0,
      payload.is_enabled !== false ? 1 : 0
    );

    const created = this.getById(result.lastInsertRowid as number);
    if (!created) {
      throw new Error('Failed to create browser source channel');
    }

    console.log(`[BrowserSourceChannelsRepository] Created channel: ${created.name}`);
    return created;
  }
  /**
   * Update an existing browser source channel
   */
  updateById(id: number, payload: Partial<BrowserSourceChannelPayload>): BrowserSourceChannel {
    const db = this.getDatabase();
    const updates: string[] = [];
    const values: any[] = [];

    if (payload.name !== undefined) {
      updates.push('name = ?');
      values.push(payload.name);
    }
    if (payload.display_name !== undefined) {
      updates.push('display_name = ?');
      values.push(payload.display_name);
    }
    if (payload.description !== undefined) {
      updates.push('description = ?');
      values.push(payload.description);
    }
    if (payload.color !== undefined) {
      updates.push('color = ?');
      values.push(payload.color);
    }
    if (payload.icon !== undefined) {
      updates.push('icon = ?');
      values.push(payload.icon);
    }
    if (payload.is_enabled !== undefined) {
      updates.push('is_enabled = ?');
      values.push(payload.is_enabled ? 1 : 0);
    }

    if (updates.length === 0) {
      const channel = this.getById(id);
      if (!channel) {
        throw new Error(`Browser source channel with ID ${id} not found`);
      }
      return channel;
    }

    updates.push('updated_at = datetime(\'now\')');
    values.push(id);

    const stmt = db.prepare(`
      UPDATE ${this.tableName}
      SET ${updates.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);

    const updated = this.getById(id);
    if (!updated) {
      throw new Error(`Browser source channel with ID ${id} not found after update`);
    }

    console.log(`[BrowserSourceChannelsRepository] Updated channel: ${updated.name}`);
    return updated;
  }  /**
   * Delete a browser source channel
   * Only allows deletion if no actions are assigned
   */
  removeChannel(id: number): boolean {
    const db = this.getDatabase();
    
    // Check if any actions are assigned to this channel
    const channel = this.getById(id);
    if (!channel) {
      return false;
    }

    // Prevent deletion of default channel
    if (channel.is_default) {
      throw new Error('Cannot delete default channel');
    }

    // Check for assigned actions
    const countStmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM event_actions
      WHERE browser_source_channel = ?
    `);
    const result = countStmt.get(channel.name) as { count: number };

    if (result.count > 0) {
      throw new Error(`Cannot delete channel with ${result.count} assigned action(s)`);
    }

    const stmt = db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`);
    const deleteResult = stmt.run(id);

    console.log(`[BrowserSourceChannelsRepository] Deleted channel: ${channel.name}`);
    return deleteResult.changes > 0;
  }
  /**
   * Get all channels for a Twitch channel
   */
  getAllByChannelId(channelId: string): BrowserSourceChannel[] {
    const db = this.getDatabase();
    const stmt = db.prepare(`
      SELECT 
        c.*,
        COUNT(a.id) as action_count
      FROM ${this.tableName} c
      LEFT JOIN event_actions a ON a.browser_source_channel = c.name AND a.channel_id = c.channel_id
      WHERE c.channel_id = ?
      GROUP BY c.id
      ORDER BY c.is_default DESC, c.created_at ASC
    `);

    return stmt.all(channelId) as BrowserSourceChannel[];
  }

  /**
   * Get a channel by name for a specific Twitch channel
   */
  getByName(channelId: string, name: string): BrowserSourceChannel | null {
    const db = this.getDatabase();
    const stmt = db.prepare(`
      SELECT 
        c.*,
        COUNT(a.id) as action_count
      FROM ${this.tableName} c
      LEFT JOIN event_actions a ON a.browser_source_channel = c.name AND a.channel_id = c.channel_id
      WHERE c.channel_id = ? AND c.name = ?
      GROUP BY c.id
    `);

    return stmt.get(channelId, name) as BrowserSourceChannel | null;
  }

  /**
   * Get the default channel for a Twitch channel
   */
  getDefault(channelId: string): BrowserSourceChannel | null {
    const db = this.getDatabase();
    const stmt = db.prepare(`
      SELECT 
        c.*,
        COUNT(a.id) as action_count
      FROM ${this.tableName} c
      LEFT JOIN event_actions a ON a.browser_source_channel = c.name AND a.channel_id = c.channel_id
      WHERE c.channel_id = ? AND c.is_default = 1
      GROUP BY c.id
    `);

    return stmt.get(channelId) as BrowserSourceChannel | null;
  }

  /**
   * Check if a channel name is available
   */
  isNameAvailable(channelId: string, name: string, excludeId?: number): boolean {
    const db = this.getDatabase();
    let stmt;
    if (excludeId) {
      stmt = db.prepare(`
        SELECT COUNT(*) as count
        FROM ${this.tableName}
        WHERE channel_id = ? AND name = ? AND id != ?
      `);
      const result = stmt.get(channelId, name, excludeId) as { count: number };
      return result.count === 0;
    } else {
      stmt = db.prepare(`
        SELECT COUNT(*) as count
        FROM ${this.tableName}
        WHERE channel_id = ? AND name = ?
      `);
      const result = stmt.get(channelId, name) as { count: number };
      return result.count === 0;
    }
  }

  /**
   * Ensure default channel exists for a Twitch channel
   */
  ensureDefaultChannel(channelId: string): BrowserSourceChannel {
    let defaultChannel = this.getDefault(channelId);
    
    if (!defaultChannel) {
      console.log(`[BrowserSourceChannelsRepository] Creating default channel for ${channelId}`);
      defaultChannel = this.create({
        channel_id: channelId,
        name: 'default',
        display_name: 'Default Channel',
        description: 'All unassigned alerts',
        color: '#9147ff',
        icon: '📺',
        is_default: true,
        is_enabled: true
      });
    }

    return defaultChannel;
  }
  /**
   * Get action count for a specific channel
   */
  getActionCount(channelId: string, channelName: string): number {
    const db = this.getDatabase();
    const stmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM event_actions
      WHERE channel_id = ? AND browser_source_channel = ?
    `);

    const result = stmt.get(channelId, channelName) as { count: number };
    return result.count;
  }
}
