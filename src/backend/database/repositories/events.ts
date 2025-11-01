import { BaseRepository } from '../base-repository';

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

export class EventsRepository extends BaseRepository<StoredEvent> {
  get tableName(): string {
    return 'events';
  }

  /**
   * Save or update an event subscription
   */
  saveSubscription(userId: string, channelId: string, eventType: string, isEnabled: boolean): void {
    const db = this.getDatabase();
    db.prepare(`
      INSERT INTO event_subscriptions (user_id, channel_id, event_type, is_enabled, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, channel_id, event_type) DO UPDATE SET
        is_enabled = excluded.is_enabled,
        updated_at = CURRENT_TIMESTAMP
    `).run(userId, channelId, eventType, isEnabled ? 1 : 0);
  }

  /**
   * Get all subscriptions for a user/channel
   */
  getSubscriptions(userId: string, channelId: string): EventSubscription[] {
    const db = this.getDatabase();
    return db.prepare(`
      SELECT * FROM event_subscriptions 
      WHERE user_id = ? AND channel_id = ?
      ORDER BY event_type
    `).all(userId, channelId) as EventSubscription[];
  }

  /**
   * Get enabled event types
   */
  getEnabledEvents(userId: string, channelId: string): string[] {
    const db = this.getDatabase();
    const rows = db.prepare(`
      SELECT event_type FROM event_subscriptions 
      WHERE user_id = ? AND channel_id = ? AND is_enabled = 1
      ORDER BY event_type
    `).all(userId, channelId) as { event_type: string }[];
    return rows.map(row => row.event_type);
  }

  /**
   * Clear all subscriptions for a user/channel
   */
  clearSubscriptions(userId: string, channelId: string): void {
    const db = this.getDatabase();
    db.prepare(`
      DELETE FROM event_subscriptions 
      WHERE user_id = ? AND channel_id = ?
    `).run(userId, channelId);
  }
  /**
   * Store an event in the database
   */
  storeEvent(eventType: string, eventData: any, channelId: string, viewerId?: string): number {
    const db = this.getDatabase();
    const result = db.prepare(`
      INSERT INTO events (event_type, event_data, channel_id, viewer_id)
      VALUES (?, ?, ?, ?)
    `).run(
      eventType,
      JSON.stringify(eventData),
      channelId,
      viewerId || null
    );
    return result.lastInsertRowid as number;
  }

  /**
   * Batch insert multiple events (used by polling systems)
   * Uses a transaction for performance when writing multiple events at once
   */
  batchInsertEvents(events: Array<{
    eventType: string;
    eventData: any;
    channelId: string;
    viewerId?: string | null;
  }>): number {
    if (events.length === 0) {
      return 0;
    }

    const db = this.getDatabase();
    const stmt = db.prepare(`
      INSERT INTO events (event_type, event_data, channel_id, viewer_id)
      VALUES (?, ?, ?, ?)
    `);

    const transaction = db.transaction((eventList: typeof events) => {
      for (const event of eventList) {
        stmt.run(
          event.eventType,
          JSON.stringify(event.eventData),
          event.channelId,
          event.viewerId || null
        );
      }
    });

    transaction(events);
    return events.length;
  }

  /**
   * Get events with optional filters
   */
  getEvents(filters: EventFilters): StoredEvent[] {
    const db = this.getDatabase();
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

    return db.prepare(query).all(...params) as StoredEvent[];
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
    const db = this.getDatabase();
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

    const result = db.prepare(query).get(...params) as { count: number };
    return result.count;
  }
}
