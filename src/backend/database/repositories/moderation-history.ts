import Database from 'better-sqlite3';
import { getDatabase } from '../connection';

export type ModerationAction = 'ban' | 'timeout' | 'unban' | 'timeout_lifted';
export type ModerationStatus = 'banned' | 'timed_out' | 'active' | 'unknown';

export interface ModerationHistoryEntry {
  id?: number;
  channel_id: string;
  viewer_id: string;
  user_id: string;
  user_login: string;
  user_name?: string;
  action: ModerationAction;
  reason?: string;
  duration_seconds?: number;
  moderator_id?: string;
  moderator_login?: string;
  action_at: string;
  detected_at?: string;
}

export interface CurrentModerationStatus extends ModerationHistoryEntry {
  display_name?: string;
  tts_voice_id?: string;
  tts_enabled?: number;
  current_status: ModerationStatus;
  timeout_expires_at?: string;
}

export class ModerationHistoryRepository {
  private db: Database.Database;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Record a single moderation action
   */
  record(entry: Omit<ModerationHistoryEntry, 'id' | 'detected_at'>): { success: boolean; id?: number; error?: string } {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO moderation_history (
          channel_id, viewer_id, user_id, user_login, user_name,
          action, reason, duration_seconds,
          moderator_id, moderator_login, action_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        entry.channel_id,
        entry.viewer_id,
        entry.user_id,
        entry.user_login,
        entry.user_name || null,
        entry.action,
        entry.reason || null,
        entry.duration_seconds || null,
        entry.moderator_id || null,
        entry.moderator_login || null,
        entry.action_at
      );

      return { success: true, id: result.lastInsertRowid as number };
    } catch (error: any) {
      console.error('[ModerationHistoryRepo] Error recording moderation action:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Batch insert moderation history records
   */
  batchInsertModerationHistory(entries: Omit<ModerationHistoryEntry, 'id' | 'detected_at'>[]): { success: boolean; count?: number; error?: string } {
    if (entries.length === 0) {
      return { success: true, count: 0 };
    }

    try {
      const stmt = this.db.prepare(`
        INSERT INTO moderation_history (
          channel_id, viewer_id, user_id, user_login, user_name,
          action, reason, duration_seconds,
          moderator_id, moderator_login, action_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const transaction = this.db.transaction((records: Omit<ModerationHistoryEntry, 'id' | 'detected_at'>[]) => {
        for (const entry of records) {
          stmt.run(
            entry.channel_id,
            entry.viewer_id,
            entry.user_id,
            entry.user_login,
            entry.user_name || null,
            entry.action,
            entry.reason || null,
            entry.duration_seconds || null,
            entry.moderator_id || null,
            entry.moderator_login || null,
            entry.action_at
          );
        }
      });

      transaction(entries);
      return { success: true, count: entries.length };
    } catch (error: any) {
      console.error('[ModerationHistoryRepo] Error batch inserting moderation history:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current moderation status for a specific user
   */
  getCurrentStatus(channelId: string, userId: string): CurrentModerationStatus | null {
    const stmt = this.db.prepare(`
      SELECT * FROM current_moderation_status
      WHERE channel_id = ? AND user_id = ?
      LIMIT 1
    `);

    return stmt.get(channelId, userId) as CurrentModerationStatus | null;
  }

  /**
   * Get all users with active bans or timeouts
   */
  getActiveModerations(channelId: string, limit?: number, offset?: number): { success: boolean; moderations?: CurrentModerationStatus[]; error?: string } {
    try {
      let query = `
        SELECT * FROM current_moderation_status
        WHERE channel_id = ? AND current_status IN ('banned', 'timed_out')
        ORDER BY detected_at DESC
      `;
      const params: any[] = [channelId];

      if (limit) {
        query += ' LIMIT ?';
        params.push(limit);
      }

      if (offset) {
        query += ' OFFSET ?';
        params.push(offset);
      }

      const stmt = this.db.prepare(query);
      const moderations = stmt.all(...params) as CurrentModerationStatus[];

      return { success: true, moderations };
    } catch (error: any) {
      console.error('[ModerationHistoryRepo] Error getting active moderations:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get moderation history for a specific user
   */
  getUserHistory(channelId: string, userId: string, limit: number = 50): { success: boolean; history?: ModerationHistoryEntry[]; error?: string } {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM moderation_history
        WHERE channel_id = ? AND user_id = ?
        ORDER BY detected_at DESC
        LIMIT ?
      `);

      const history = stmt.all(channelId, userId, limit) as ModerationHistoryEntry[];
      return { success: true, history };
    } catch (error: any) {
      console.error('[ModerationHistoryRepo] Error getting user history:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get recent moderation events across all users
   */
  getRecentEvents(channelId: string, limit: number = 50): { success: boolean; events?: ModerationHistoryEntry[]; error?: string } {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM moderation_history
        WHERE channel_id = ?
        ORDER BY detected_at DESC
        LIMIT ?
      `);

      const events = stmt.all(channelId, limit) as ModerationHistoryEntry[];
      return { success: true, events };
    } catch (error: any) {
      console.error('[ModerationHistoryRepo] Error getting recent events:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get count of users with active bans
   */
  getActiveBansCount(channelId: string): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM current_moderation_status
      WHERE channel_id = ? AND current_status = 'banned'
    `);

    const result = stmt.get(channelId) as { count: number };
    return result?.count || 0;
  }

  /**
   * Get count of users with active timeouts
   */
  getActiveTimeoutsCount(channelId: string): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM current_moderation_status
      WHERE channel_id = ? AND current_status = 'timed_out'
    `);

    const result = stmt.get(channelId) as { count: number };
    return result?.count || 0;
  }

  /**
   * Get all currently banned users
   */
  getAllBanned(channelId: string): CurrentModerationStatus[] {
    const stmt = this.db.prepare(`
      SELECT * FROM current_moderation_status
      WHERE channel_id = ? AND current_status = 'banned'
      ORDER BY detected_at DESC
    `);

    return stmt.all(channelId) as CurrentModerationStatus[];
  }

  /**
   * Get all currently timed out users
   */
  getAllTimedOut(channelId: string): CurrentModerationStatus[] {
    const stmt = this.db.prepare(`
      SELECT * FROM current_moderation_status
      WHERE channel_id = ? AND current_status = 'timed_out'
      ORDER BY detected_at DESC
    `);

    return stmt.all(channelId) as CurrentModerationStatus[];
  }
}
