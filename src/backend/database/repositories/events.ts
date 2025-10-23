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
}
