/**
 * Viewer History Repository
 * Handles queries for viewer action/event history
 */

import { BaseRepository } from '../base-repository';
import { getDatabase } from '../connection';
import type { Database } from 'better-sqlite3';

export interface ViewerHistoryEvent {
  id?: number;
  event_type: string;
  action: string;
  description: string;
  metadata: any;
  created_at: string;
}

export interface ViewerDetailedHistory {
  viewerId: string;
  displayName: string | null;
  currentStatus: {
    moderation: string | null;
    followed: boolean;
    roles: string[];
    subscriptionStatus: string | null;
  };
  timeline: Array<{
    id: number;
    timestamp: string;
    category: 'role' | 'moderation' | 'subscription' | 'event' | 'follow';
    action: string;
    description: string;
    details: Record<string, any>;
  }>;
}

export class ViewerHistoryRepository {
  private _db: Database | null = null;

  /**
   * Lazy getter for database connection
   * Initializes only when first accessed
   */
  private get db(): Database {
    if (!this._db) {
      this._db = getDatabase();
    }
    return this._db;
  }

  /**
   * Get complete viewer history including all actions, events, and changes
   */
  getViewerDetailedHistory(viewerId: string): ViewerDetailedHistory | null {
    const viewer = this.db.prepare(`
      SELECT id, display_name FROM viewers WHERE id = ?
    `).get(viewerId) as any;

    if (!viewer) {
      return null;
    }

    // Get current status
    const currentStatus = this.db.prepare(`
      SELECT * FROM viewer_subscription_status WHERE id = ?
    `).get(viewerId) as any;

    // Get roles history
    const rolesHistory = this.db.prepare(`
      SELECT 
        'role' as category,
        role_type as role,
        CASE 
          WHEN revoked_at IS NULL THEN 'granted'
          ELSE 'revoked'
        END as action,
        granted_at as timestamp,
        revoked_at
      FROM viewer_roles
      WHERE viewer_id = ?
      ORDER BY granted_at DESC
    `).all(viewerId) as any[];

    // Get moderation history
    const moderationHistory = this.db.prepare(`
      SELECT 
        'moderation' as category,
        action,
        CASE 
          WHEN action = 'ban' THEN 'Banned'
          WHEN action = 'unban' THEN 'Unbanned'
          WHEN action = 'timeout' THEN 'Timed Out'
          WHEN action = 'timeout_lifted' THEN 'Timeout Lifted'
          ELSE action
        END as description,
        reason,
        duration_seconds,
        moderator_login,
        action_at as timestamp,
        detected_at
      FROM moderation_history
      WHERE viewer_id = ?
      ORDER BY action_at DESC
    `).all(viewerId) as any[];

    // Get follower history
    const followerHistory = this.db.prepare(`
      SELECT 
        'follow' as category,
        action,
        CASE 
          WHEN action = 'follow' THEN 'Started Following'
          WHEN action = 'unfollow' THEN 'Unfollowed'
          ELSE action
        END as description,
        followed_at as timestamp,
        detected_at
      FROM follower_history
      WHERE viewer_id = ?
      ORDER BY detected_at DESC
    `).all(viewerId) as any[];

    // Get subscription history
    const subscriptionHistory = this.db.prepare(`
      SELECT 
        'subscription' as category,
        tier as tier,
        CASE 
          WHEN is_gift = 1 THEN 'Gifted Subscription'
          ELSE 'Subscribed'
        END as description,
        tier,
        is_gift,
        start_date as timestamp,
        end_date
      FROM viewer_subscriptions
      WHERE viewer_id = ?
      ORDER BY start_date DESC
    `).all(viewerId) as any[];

    // Combine and sort all events
    const allEvents: any[] = [];

    rolesHistory.forEach((event: any) => {
      allEvents.push({
        timestamp: event.timestamp || new Date().toISOString(),
        category: 'role',
        action: event.action,
        description: `${event.action.charAt(0).toUpperCase() + event.action.slice(1)} as ${event.role?.toUpperCase() || 'Unknown'}`,
        details: {
          role: event.role,
          revokedAt: event.revoked_at
        }
      });
    });

    moderationHistory.forEach((event: any) => {
      allEvents.push({
        timestamp: event.timestamp || event.detected_at,
        category: 'moderation',
        action: event.action,
        description: event.description,
        details: {
          reason: event.reason,
          durationSeconds: event.duration_seconds,
          moderator: event.moderator_login
        }
      });
    });

    followerHistory.forEach((event: any) => {
      allEvents.push({
        timestamp: event.timestamp || event.detected_at,
        category: 'follow',
        action: event.action,
        description: event.description,
        details: {
          followedAt: event.timestamp
        }
      });
    });

    subscriptionHistory.forEach((event: any) => {
      allEvents.push({
        timestamp: event.timestamp,
        category: 'subscription',
        action: 'subscription',
        description: event.description,
        details: {
          tier: event.tier,
          isGift: event.is_gift,
          endDate: event.end_date
        }
      });
    });

    // Sort by timestamp descending
    allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Add IDs
    const timelineWithIds = allEvents.map((event, index) => ({
      id: index + 1,
      ...event
    }));

    return {
      viewerId,
      displayName: viewer.display_name,
      currentStatus: {
        moderation: currentStatus?.moderation_status || null,
        followed: currentStatus?.is_follower === 1,
        roles: [
          currentStatus?.is_broadcaster ? 'Broadcaster' : null,
          currentStatus?.is_moderator ? 'Moderator' : null,
          currentStatus?.is_vip ? 'VIP' : null
        ].filter(Boolean) as string[],
        subscriptionStatus: currentStatus?.subscription_status || null
      },
      timeline: timelineWithIds
    };
  }

  /**
   * Get viewer action statistics
   */
  getViewerStats(viewerId: string) {
    const stats = {
      firstSeen: null as string | null,
      lastSeen: null as string | null,
      totalEvents: 0,
      moderationActions: 0,
      roleChanges: 0,
      subscriptionDuration: 0
    };

    // First and last seen
    const timerange = this.db.prepare(`
      SELECT 
        (SELECT created_at FROM viewers WHERE id = ?) as first_seen,
        (SELECT MAX(detected_at) FROM (
          SELECT detected_at FROM moderation_history WHERE viewer_id = ?
          UNION ALL
          SELECT detected_at FROM follower_history WHERE viewer_id = ?
          UNION ALL
          SELECT created_at FROM events WHERE viewer_id = ?
        )) as last_seen
    `).get(viewerId, viewerId, viewerId, viewerId) as any;

    stats.firstSeen = timerange?.first_seen;
    stats.lastSeen = timerange?.last_seen;

    // Count moderation actions
    stats.moderationActions = (this.db.prepare(`
      SELECT COUNT(*) as count FROM moderation_history WHERE viewer_id = ?
    `).get(viewerId) as any)?.count || 0;

    // Count role changes
    stats.roleChanges = (this.db.prepare(`
      SELECT COUNT(*) as count FROM viewer_roles WHERE viewer_id = ?
    `).get(viewerId) as any)?.count || 0;

    // Count total events
    stats.totalEvents = (this.db.prepare(`
      SELECT COUNT(*) as count FROM events WHERE viewer_id = ?
    `).get(viewerId) as any)?.count || 0;

    return stats;
  }
}
