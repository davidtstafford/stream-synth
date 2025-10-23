import { getDatabase } from '../connection';

export interface ConnectionSession {
  id: number;
  user_id: string;
  user_login: string;
  channel_id: string;
  channel_login: string;
  is_broadcaster: boolean;
  connected_at: string;
  disconnected_at: string | null;
  is_current: boolean;
}

export class SessionsRepository {
  create(session: Omit<ConnectionSession, 'id' | 'connected_at' | 'disconnected_at'>): number {
    const db = getDatabase();
    
    // First, mark all existing sessions as not current
    db.prepare('UPDATE connection_sessions SET is_current = 0').run();
    
    // Insert new session
    const stmt = db.prepare(`
      INSERT INTO connection_sessions (user_id, user_login, channel_id, channel_login, is_broadcaster, is_current)
      VALUES (?, ?, ?, ?, ?, 1)
    `);
    
    const result = stmt.run(
      session.user_id,
      session.user_login,
      session.channel_id,
      session.channel_login,
      session.is_broadcaster ? 1 : 0
    );
    
    return result.lastInsertRowid as number;
  }

  getCurrentSession(): ConnectionSession | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM connection_sessions WHERE is_current = 1 LIMIT 1');
    return stmt.get() as ConnectionSession | null;
  }

  endCurrentSession(): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE connection_sessions 
      SET disconnected_at = CURRENT_TIMESTAMP, is_current = 0
      WHERE is_current = 1
    `);
    stmt.run();
  }

  getRecentSessions(limit: number = 10): ConnectionSession[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM connection_sessions 
      ORDER BY connected_at DESC 
      LIMIT ?
    `);
    return stmt.all(limit) as ConnectionSession[];
  }
}
