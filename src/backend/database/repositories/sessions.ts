import { BaseRepository } from '../base-repository';

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

export class SessionsRepository extends BaseRepository<ConnectionSession> {
  get tableName(): string {
    return 'connection_sessions';
  }

  /**
   * Create a new session and mark it as current
   * Automatically marks all other sessions as not current
   */
  create(session: Omit<ConnectionSession, 'id' | 'connected_at' | 'disconnected_at'>): number {
    const db = this.getDatabase();
    
    // Mark all existing sessions as not current
    db.prepare('UPDATE connection_sessions SET is_current = 0').run();
    
    // Insert new session
    const result = db.prepare(`
      INSERT INTO connection_sessions (user_id, user_login, channel_id, channel_login, is_broadcaster, is_current)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(
      session.user_id,
      session.user_login,
      session.channel_id,
      session.channel_login,
      session.is_broadcaster ? 1 : 0
    );
    
    return result.lastInsertRowid as number;
  }

  /**
   * Get the currently active session
   */
  getCurrentSession(): ConnectionSession | null {
    const db = this.getDatabase();
    return db.prepare('SELECT * FROM connection_sessions WHERE is_current = 1 LIMIT 1').get() as ConnectionSession | null;
  }

  /**
   * End the current session and mark it as disconnected
   */
  endCurrentSession(): void {
    const db = this.getDatabase();
    db.prepare(`
      UPDATE connection_sessions 
      SET disconnected_at = CURRENT_TIMESTAMP, is_current = 0
      WHERE is_current = 1
    `).run();
  }

  /**
   * Get recent sessions with optional limit
   */
  getRecentSessions(limit: number = 10): ConnectionSession[] {
    const db = this.getDatabase();
    return db.prepare(`
      SELECT * FROM connection_sessions 
      ORDER BY connected_at DESC 
      LIMIT ?
    `).all(limit) as ConnectionSession[];
  }
}
