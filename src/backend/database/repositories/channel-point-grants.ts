import { BaseRepository } from '../base-repository';

export interface ChannelPointGrant {
  id: number;
  viewer_id: string;
  grant_type: 'limited_access' | 'premium_voice_access';
  redeem_name: string;
  duration_mins: number;
  granted_at: string;
  expires_at: string;
}

export class ChannelPointGrantsRepository extends BaseRepository<ChannelPointGrant> {
  get tableName(): string {
    return 'channel_point_grants';
  }

  /**
   * Create a new channel point grant for a viewer
   */
  createGrant(
    viewerId: string, 
    grantType: 'limited_access' | 'premium_voice_access',
    redeemName: string,
    durationMins: number
  ): void {
    const db = this.getDatabase();
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationMins * 60 * 1000);
    
    db.prepare(`
      INSERT INTO channel_point_grants 
        (viewer_id, grant_type, redeem_name, duration_mins, granted_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      viewerId,
      grantType,
      redeemName,
      durationMins,
      now.toISOString(),
      expiresAt.toISOString()
    );
  }

  /**
   * Check if a viewer has an active grant of a specific type
   */
  hasActiveGrant(viewerId: string, grantType: 'limited_access' | 'premium_voice_access'): boolean {
    const db = this.getDatabase();
    const now = new Date().toISOString();
    
    const result = db.prepare(`
      SELECT COUNT(*) as count 
      FROM channel_point_grants 
      WHERE viewer_id = ? 
        AND grant_type = ? 
        AND expires_at > ?
    `).get(viewerId, grantType, now) as { count: number };
    
    return result.count > 0;
  }

  /**
   * Get active grant for a viewer (returns most recent if multiple)
   */
  getActiveGrant(viewerId: string, grantType: 'limited_access' | 'premium_voice_access'): ChannelPointGrant | null {
    const db = this.getDatabase();
    const now = new Date().toISOString();
    
    return db.prepare(`
      SELECT * FROM channel_point_grants 
      WHERE viewer_id = ? 
        AND grant_type = ? 
        AND expires_at > ?
      ORDER BY granted_at DESC
      LIMIT 1
    `).get(viewerId, grantType, now) as ChannelPointGrant | null;
  }

  /**
   * Get all active grants for a viewer
   */
  getActiveGrants(viewerId: string): ChannelPointGrant[] {
    const db = this.getDatabase();
    const now = new Date().toISOString();
    
    return db.prepare(`
      SELECT * FROM channel_point_grants 
      WHERE viewer_id = ? 
        AND expires_at > ?
      ORDER BY granted_at DESC
    `).all(viewerId, now) as ChannelPointGrant[];
  }

  /**
   * Get all grants for a viewer (including expired)
   */
  getAllGrants(viewerId: string): ChannelPointGrant[] {
    const db = this.getDatabase();
    
    return db.prepare(`
      SELECT * FROM channel_point_grants 
      WHERE viewer_id = ?
      ORDER BY granted_at DESC
    `).all(viewerId) as ChannelPointGrant[];
  }

  /**
   * Cleanup expired grants (delete old records)
   * Returns number of grants deleted
   */
  cleanupExpiredGrants(olderThanDays: number = 7): number {
    const db = this.getDatabase();
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const result = db.prepare(`
      DELETE FROM channel_point_grants 
      WHERE expires_at < ?
    `).run(cutoffDate.toISOString());
    
    return result.changes;
  }

  /**
   * Get time remaining on active grant (in minutes)
   * Returns null if no active grant
   */
  getTimeRemaining(viewerId: string, grantType: 'limited_access' | 'premium_voice_access'): number | null {
    const grant = this.getActiveGrant(viewerId, grantType);
    if (!grant) {
      return null;
    }

    const now = new Date();
    const expiresAt = new Date(grant.expires_at);
    const remainingMs = expiresAt.getTime() - now.getTime();
    
    if (remainingMs <= 0) {
      return null;
    }

    return Math.ceil(remainingMs / (60 * 1000)); // Convert to minutes, round up
  }

  /**
   * Get count of active grants by type
   */
  getActiveGrantCount(grantType?: 'limited_access' | 'premium_voice_access'): number {
    const db = this.getDatabase();
    const now = new Date().toISOString();
    
    if (grantType) {
      const result = db.prepare(`
        SELECT COUNT(*) as count 
        FROM channel_point_grants 
        WHERE grant_type = ? AND expires_at > ?
      `).get(grantType, now) as { count: number };
      return result.count;
    } else {
      const result = db.prepare(`
        SELECT COUNT(*) as count 
        FROM channel_point_grants 
        WHERE expires_at > ?
      `).get(now) as { count: number };
      return result.count;
    }
  }

  /**
   * Revoke/cancel a specific grant (set expiry to now)
   */
  revokeGrant(grantId: number): void {
    const db = this.getDatabase();
    const now = new Date().toISOString();
    
    db.prepare(`
      UPDATE channel_point_grants 
      SET expires_at = ?
      WHERE id = ?
    `).run(now, grantId);
  }

  /**
   * Revoke all grants for a viewer
   */
  revokeAllGrants(viewerId: string): void {
    const db = this.getDatabase();
    const now = new Date().toISOString();
    
    db.prepare(`
      UPDATE channel_point_grants 
      SET expires_at = ?
      WHERE viewer_id = ? AND expires_at > ?
    `).run(now, viewerId, now);
  }
}
