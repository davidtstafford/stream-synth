import { getDatabase } from '../connection';

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
}

export class SubscriptionsRepository {
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
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO viewer_subscriptions (id, viewer_id, tier, is_gift, start_date, end_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        tier = excluded.tier,
        is_gift = excluded.is_gift,
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(
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
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM viewer_subscriptions WHERE viewer_id = ?
    `);
    return stmt.get(viewerId) as ViewerSubscription | null;
  }

  /**
   * Get subscription by ID
   */
  getById(id: string): ViewerSubscription | null {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM viewer_subscriptions WHERE id = ?
    `);
    return stmt.get(id) as ViewerSubscription | null;
  }

  /**
   * Delete subscription by viewer ID
   */
  deleteByViewerId(viewerId: string): void {
    const db = getDatabase();
    const stmt = db.prepare(`DELETE FROM viewer_subscriptions WHERE viewer_id = ?`);
    stmt.run(viewerId);
  }

  /**
   * Get all viewers with subscription status
   */
  getAllViewersWithStatus(limit?: number, offset?: number): ViewerWithSubscription[] {
    const db = getDatabase();
    let query = `SELECT * FROM viewer_subscription_status ORDER BY display_name`;
    
    if (limit) {
      query += ` LIMIT ${limit}`;
    }
    if (offset) {
      query += ` OFFSET ${offset}`;
    }

    const stmt = db.prepare(query);
    return stmt.all() as ViewerWithSubscription[];
  }

  /**
   * Search viewers by display name with subscription status
   */
  searchViewersWithStatus(
    query: string,
    limit: number = 50
  ): ViewerWithSubscription[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM viewer_subscription_status 
      WHERE display_name LIKE ?
      ORDER BY display_name
      LIMIT ?
    `);
    const searchParam = `%${query}%`;
    return stmt.all(searchParam, limit) as ViewerWithSubscription[];
  }

  /**
   * Get all active subscribers
   */
  getActiveSubscribers(): ViewerWithSubscription[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM viewer_subscription_status 
      WHERE tier IS NOT NULL
      ORDER BY display_name
    `);
    return stmt.all() as ViewerWithSubscription[];
  }
}
