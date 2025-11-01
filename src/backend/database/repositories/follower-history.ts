import { BaseRepository } from '../base-repository';

export interface FollowerHistory {
  id: number;
  channel_id: string;
  viewer_id: string;
  follower_user_id: string;
  follower_user_login: string;
  follower_user_name: string | null;
  action: 'follow' | 'unfollow';
  followed_at: string | null;
  detected_at: string;
}

export interface CurrentFollower {
  channel_id: string;
  viewer_id: string;
  follower_user_id: string;
  follower_user_login: string;
  follower_user_name: string | null;
  followed_at: string | null;
  detected_at: string;
  tts_enabled: number;
  tts_voice: string | null;
}

export class FollowerHistoryRepository extends BaseRepository<FollowerHistory> {
  get tableName(): string {
    return 'follower_history';
  }

  /**
   * Record a follow action
   */
  recordFollow(
    channelId: string,
    viewerId: string,
    followerUserId: string,
    followerUserLogin: string,
    followerUserName: string | null,
    followedAt: string | null
  ): number {
    const db = this.getDatabase();
    const stmt = db.prepare(`
      INSERT INTO follower_history (
        channel_id, viewer_id, follower_user_id, follower_user_login,
        follower_user_name, action, followed_at
      ) VALUES (?, ?, ?, ?, ?, 'follow', ?)
    `);

    const result = stmt.run(
      channelId,
      viewerId,
      followerUserId,
      followerUserLogin,
      followerUserName,
      followedAt
    );

    return result.lastInsertRowid as number;
  }

  /**
   * Record an unfollow action
   */
  recordUnfollow(
    channelId: string,
    viewerId: string,
    followerUserId: string,
    followerUserLogin: string,
    followerUserName: string | null
  ): number {
    const db = this.getDatabase();
    const stmt = db.prepare(`
      INSERT INTO follower_history (
        channel_id, viewer_id, follower_user_id, follower_user_login,
        follower_user_name, action, followed_at
      ) VALUES (?, ?, ?, ?, ?, 'unfollow', NULL)
    `);

    const result = stmt.run(
      channelId,
      viewerId,
      followerUserId,
      followerUserLogin,
      followerUserName
    );

    return result.lastInsertRowid as number;
  }
  /**
   * Batch insert follower history records
   */
  batchInsertFollowerHistory(
    records: Array<{
      channelId: string;
      viewerId: string;
      followerUserId: string;
      followerUserLogin: string;
      followerUserName: string | null;
      action: 'follow' | 'unfollow';
      followedAt: string | null;
    }>
  ): number {
    if (records.length === 0) {
      return 0;
    }

    const db = this.getDatabase();
    
    const insertStmt = db.prepare(`
      INSERT INTO follower_history (
        channel_id, viewer_id, follower_user_id, follower_user_login,
        follower_user_name, action, followed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    type RecordType = typeof records[0];
    const transaction = db.transaction((items: RecordType[]) => {
      for (const record of items) {
        insertStmt.run(
          record.channelId,
          record.viewerId,
          record.followerUserId,
          record.followerUserLogin,
          record.followerUserName,
          record.action,
          record.followedAt
        );
      }
    });

    transaction(records);
    return records.length;
  }

  /**
   * Get all current followers for a channel (from VIEW)
   */
  getCurrentFollowers(channelId: string): CurrentFollower[] {
    const db = this.getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM current_followers
      WHERE channel_id = ?
      ORDER BY detected_at DESC
    `);

    return stmt.all(channelId) as CurrentFollower[];
  }

  /**
   * Check if a user is currently following
   */
  isCurrentlyFollowing(channelId: string, followerUserId: string): boolean {
    const db = this.getDatabase();
    const result = db.prepare(`
      SELECT COUNT(*) as count
      FROM current_followers
      WHERE channel_id = ? AND follower_user_id = ?
    `).get(channelId, followerUserId) as { count: number };

    return result.count > 0;
  }

  /**
   * Get follower history for a specific user
   */
  getFollowerHistory(channelId: string, followerUserId: string): FollowerHistory[] {
    const db = this.getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM follower_history
      WHERE channel_id = ? AND follower_user_id = ?
      ORDER BY detected_at DESC
    `);

    return stmt.all(channelId, followerUserId) as FollowerHistory[];
  }

  /**
   * Get recent follower events (follows and unfollows)
   */
  getRecentFollowerEvents(channelId: string, limit: number = 50): FollowerHistory[] {
    const db = this.getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM follower_history
      WHERE channel_id = ?
      ORDER BY detected_at DESC
      LIMIT ?
    `);

    return stmt.all(channelId, limit) as FollowerHistory[];
  }

  /**
   * Get follower count for a channel
   */
  getFollowerCount(channelId: string): number {
    const db = this.getDatabase();
    const result = db.prepare(`
      SELECT COUNT(*) as count
      FROM current_followers
      WHERE channel_id = ?
    `).get(channelId) as { count: number };

    return result.count;
  }

  /**
   * Get all current follower user IDs for a channel (for state comparison)
   */
  getAllCurrentFollowerIds(channelId: string): string[] {
    const db = this.getDatabase();
    const stmt = db.prepare(`
      SELECT follower_user_id FROM current_followers
      WHERE channel_id = ?
    `);

    const results = stmt.all(channelId) as Array<{ follower_user_id: string }>;
    return results.map(r => r.follower_user_id);
  }
}
