import { BaseRepository } from '../base-repository';

export interface ViewerSubscription {
  id: string;
  viewer_id: string;
  tier: string;
  is_gift: number;
  start_date: string;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ViewerWithSubscription {
  id: string;
  display_name: string | null;
  tts_voice_id: string | null;
  tts_enabled: number;
  created_at: string;
  updated_at: string;
  tier: string | null;
  is_gift: number | null;
  start_date: string | null;
  end_date: string | null;
  subscription_status: string;
  is_vip: number | null;
  is_moderator: number | null;
  is_broadcaster: number | null;
  moderation_status: string | null; // 'banned', 'timed_out', 'active', null
  moderation_reason: string | null;
  moderation_expires_at: string | null; // For timeouts
}

export class SubscriptionsRepository extends BaseRepository<ViewerSubscription> {
  get tableName(): string {
    return 'viewer_subscriptions';
  }

  /**
   * Upsert a subscription for a viewer
   */
  upsert(subscription: {
    id: string;
    viewer_id: string;
    tier: string;
    is_gift: number;
    start_date: string;
    end_date?: string | null;
  }): void {
    const db = this.getDatabase();
    db.prepare(`
      INSERT INTO viewer_subscriptions (id, viewer_id, tier, is_gift, start_date, end_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        tier = excluded.tier,
        is_gift = excluded.is_gift,
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      subscription.id,
      subscription.viewer_id,
      subscription.tier,
      subscription.is_gift,
      subscription.start_date,
      subscription.end_date || null
    );
  }

  /**
   * Get subscription by viewer ID
   */
  getByViewerId(viewerId: string): ViewerSubscription | null {
    const db = this.getDatabase();
    return db.prepare(`
      SELECT * FROM viewer_subscriptions WHERE viewer_id = ?
    `).get(viewerId) as ViewerSubscription | null;
  }

  /**
   * Delete subscription by viewer ID
   */
  deleteByViewerId(viewerId: string): void {
    const db = this.getDatabase();
    db.prepare(`DELETE FROM viewer_subscriptions WHERE viewer_id = ?`).run(viewerId);
  }

  /**
   * Get all viewers with subscription status
   */
  getAllViewersWithStatus(limit?: number, offset?: number): ViewerWithSubscription[] {
    const db = this.getDatabase();
    let query = `SELECT * FROM viewer_subscription_status ORDER BY display_name`;
    
    if (limit) {
      query += ` LIMIT ${limit}`;
    }
    if (offset) {
      query += ` OFFSET ${offset}`;
    }

    return db.prepare(query).all() as ViewerWithSubscription[];
  }

  /**
   * Search viewers by display name with subscription status
   */
  searchViewersWithStatus(
    query: string,
    limit: number = 50
  ): ViewerWithSubscription[] {
    const db = this.getDatabase();
    const searchParam = `%${query}%`;
    return db.prepare(`
      SELECT * FROM viewer_subscription_status 
      WHERE display_name LIKE ?
      ORDER BY display_name
      LIMIT ?
    `).all(searchParam, limit) as ViewerWithSubscription[];
  }

  /**
   * Get all active subscribers
   */
  getActiveSubscribers(): ViewerWithSubscription[] {
    const db = this.getDatabase();
    return db.prepare(`
      SELECT * FROM viewer_subscription_status 
      WHERE tier IS NOT NULL
      ORDER BY display_name
    `).all() as ViewerWithSubscription[];
  }
}
