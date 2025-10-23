import { getDatabase } from '../connection';

export interface EventSubscription {
  id: number;
  user_id: string;
  channel_id: string;
  event_type: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface StoredEvent {
  id: number;
  event_type: string;
  event_data: string; // JSON string
  viewer_id: string | null;
  channel_id: string;
  created_at: string;
}

export interface EventFilters {
  channelId?: string;
  eventType?: string;
  viewerId?: string;
  startDate?: string;
  endDate?: string;
  searchText?: string;
  limit?: number;
  offset?: number;
}

export class EventsRepository {
  saveSubscription(userId: string, channelId: string, eventType: string, isEnabled: boolean): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO event_subscriptions (user_id, channel_id, event_type, is_enabled, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, channel_id, event_type) DO UPDATE SET
        is_enabled = excluded.is_enabled,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(userId, channelId, eventType, isEnabled ? 1 : 0);
  }

  getSubscriptions(userId: string, channelId: string): EventSubscription[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM event_subscriptions 
      WHERE user_id = ? AND channel_id = ?
      ORDER BY event_type
    `);
    return stmt.all(userId, channelId) as EventSubscription[];
  }

  getEnabledEvents(userId: string, channelId: string): string[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT event_type FROM event_subscriptions 
      WHERE user_id = ? AND channel_id = ? AND is_enabled = 1
      ORDER BY event_type
    `);
    const rows = stmt.all(userId, channelId) as { event_type: string }[];
    return rows.map(row => row.event_type);
  }

  clearSubscriptions(userId: string, channelId: string): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      DELETE FROM event_subscriptions 
      WHERE user_id = ? AND channel_id = ?
    `);
    stmt.run(userId, channelId);
  }

  /**
   * Store an event in the database
   */
  storeEvent(eventType: string, eventData: any, channelId: string, viewerId?: string): number {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO events (event_type, event_data, channel_id, viewer_id)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(
      eventType,
      JSON.stringify(eventData),
      channelId,
      viewerId || null
    );
    return result.lastInsertRowid as number;
  }

  /**
   * Get events with optional filters
   */
  getEvents(filters: EventFilters): StoredEvent[] {
    const db = getDatabase();
    let query = `
      SELECT e.*, v.username as viewer_username, v.display_name as viewer_display_name
      FROM events e
      LEFT JOIN viewers v ON e.viewer_id = v.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.channelId) {
      query += ` AND e.channel_id = ?`;
      params.push(filters.channelId);
    }

    if (filters.eventType) {
      query += ` AND e.event_type = ?`;
      params.push(filters.eventType);
    }

    if (filters.viewerId) {
      query += ` AND e.viewer_id = ?`;
      params.push(filters.viewerId);
    }

    if (filters.startDate) {
      query += ` AND e.created_at >= ?`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND e.created_at <= ?`;
      params.push(filters.endDate);
    }

    if (filters.searchText) {
      query += ` AND (e.event_data LIKE ? OR v.username LIKE ? OR v.display_name LIKE ?)`;
      const searchParam = `%${filters.searchText}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    query += ` ORDER BY e.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ` OFFSET ?`;
      params.push(filters.offset);
    }

    const stmt = db.prepare(query);
    return stmt.all(...params) as StoredEvent[];
  }

  /**
   * Get chat events specifically
   */
  getChatEvents(channelId: string, limit: number = 100): StoredEvent[] {
    return this.getEvents({
      channelId,
      eventType: 'channel.chat.message',
      limit,
      offset: 0
    });
  }

  /**
   * Get count of events
   */
  getEventCount(channelId?: string, eventType?: string): number {
    const db = getDatabase();
    let query = `SELECT COUNT(*) as count FROM events WHERE 1=1`;
    const params: any[] = [];

    if (channelId) {
      query += ` AND channel_id = ?`;
      params.push(channelId);
    }

    if (eventType) {
      query += ` AND event_type = ?`;
      params.push(eventType);
    }

    const stmt = db.prepare(query);
    const result = stmt.get(...params) as { count: number };
    return result.count;
  }
}
