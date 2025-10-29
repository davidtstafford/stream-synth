import { BaseRepository } from '../base-repository';

export interface ViewerRole {
  id: number;
  viewer_id: string;
  role_type: 'vip' | 'moderator' | 'broadcaster';
  granted_at: string;
  revoked_at: string | null;
}

export class ViewerRolesRepository extends BaseRepository<ViewerRole> {
  get tableName(): string {
    return 'viewer_roles';
  }

  /**
   * Check if a viewer currently has VIP status
   */
  isViewerVIP(viewerId: string): boolean {
    const db = this.getDatabase();
    const result = db.prepare(`
      SELECT COUNT(*) as count 
      FROM viewer_roles 
      WHERE viewer_id = ? 
        AND role_type = 'vip' 
        AND revoked_at IS NULL
    `).get(viewerId) as { count: number };
    
    return result.count > 0;
  }

  /**
   * Check if a viewer currently has Moderator status
   */
  isViewerModerator(viewerId: string): boolean {
    const db = this.getDatabase();
    const result = db.prepare(`
      SELECT COUNT(*) as count 
      FROM viewer_roles 
      WHERE viewer_id = ? 
        AND role_type = 'moderator' 
        AND revoked_at IS NULL
    `).get(viewerId) as { count: number };
    
    return result.count > 0;
  }

  /**
   * Check if a viewer has a specific role
   */
  hasRole(viewerId: string, roleType: 'vip' | 'moderator' | 'broadcaster'): boolean {
    const db = this.getDatabase();
    const result = db.prepare(`
      SELECT COUNT(*) as count 
      FROM viewer_roles 
      WHERE viewer_id = ? 
        AND role_type = ? 
        AND revoked_at IS NULL
    `).get(viewerId, roleType) as { count: number };
    
    return result.count > 0;
  }

  /**
   * Grant a role to a viewer
   */
  grantRole(viewerId: string, roleType: 'vip' | 'moderator' | 'broadcaster'): void {
    const db = this.getDatabase();
    
    // Check if role already exists and is active
    const existing = db.prepare(`
      SELECT * FROM viewer_roles 
      WHERE viewer_id = ? AND role_type = ? AND revoked_at IS NULL
    `).get(viewerId, roleType);
    
    if (existing) {
      // Role already active, nothing to do
      return;
    }

    // Check if role was previously revoked
    const revoked = db.prepare(`
      SELECT * FROM viewer_roles 
      WHERE viewer_id = ? AND role_type = ? AND revoked_at IS NOT NULL
    `).get(viewerId, roleType) as ViewerRole | undefined;

    if (revoked) {
      // Re-activate the role
      db.prepare(`
        UPDATE viewer_roles 
        SET revoked_at = NULL, granted_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(revoked.id);
    } else {
      // Create new role
      db.prepare(`
        INSERT INTO viewer_roles (viewer_id, role_type, granted_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `).run(viewerId, roleType);
    }
  }

  /**
   * Revoke a role from a viewer
   */
  revokeRole(viewerId: string, roleType: 'vip' | 'moderator' | 'broadcaster'): void {
    const db = this.getDatabase();
    
    db.prepare(`
      UPDATE viewer_roles 
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE viewer_id = ? AND role_type = ? AND revoked_at IS NULL
    `).run(viewerId, roleType);
  }
  /**
   * Sync VIP list from Twitch
   * Grants VIP to all viewers in the list, revokes VIP from others
   */
  syncVIPs(viewerIds: string[]): void {
    const db = this.getDatabase();
    
    // Start transaction for atomic operation
    db.prepare('BEGIN').run();
    
    try {
      // Grant VIP to all viewers in the list
      for (const viewerId of viewerIds) {
        this.grantRole(viewerId, 'vip');
      }

      // Revoke VIP from viewers not in the list
      if (viewerIds.length > 0) {
        const placeholders = viewerIds.map(() => '?').join(',');
        db.prepare(`
          UPDATE viewer_roles 
          SET revoked_at = CURRENT_TIMESTAMP
          WHERE role_type = 'vip' 
            AND revoked_at IS NULL
            AND viewer_id NOT IN (${placeholders})
        `).run(...viewerIds);
      } else {
        // No VIPs - revoke all
        db.prepare(`
          UPDATE viewer_roles 
          SET revoked_at = CURRENT_TIMESTAMP
          WHERE role_type = 'vip' AND revoked_at IS NULL
        `).run();
      }

      db.prepare('COMMIT').run();
    } catch (error) {
      db.prepare('ROLLBACK').run();
      throw error;
    }
  }

  /**
   * Sync Moderator list from Twitch
   * Grants moderator to all viewers in the list, revokes moderator from others
   */
  syncModerators(viewerIds: string[]): void {
    const db = this.getDatabase();
    
    // Start transaction for atomic operation
    db.prepare('BEGIN').run();
    
    try {
      // Grant moderator to all viewers in the list
      for (const viewerId of viewerIds) {
        this.grantRole(viewerId, 'moderator');
      }

      // Revoke moderator from viewers not in the list
      if (viewerIds.length > 0) {
        const placeholders = viewerIds.map(() => '?').join(',');
        db.prepare(`
          UPDATE viewer_roles 
          SET revoked_at = CURRENT_TIMESTAMP
          WHERE role_type = 'moderator' 
            AND revoked_at IS NULL
            AND viewer_id NOT IN (${placeholders})
        `).run(...viewerIds);
      } else {
        // No moderators - revoke all
        db.prepare(`
          UPDATE viewer_roles 
          SET revoked_at = CURRENT_TIMESTAMP
          WHERE role_type = 'moderator' AND revoked_at IS NULL
        `).run();
      }

      db.prepare('COMMIT').run();
    } catch (error) {
      db.prepare('ROLLBACK').run();
      throw error;
    }
  }

  /**
   * Get all active VIPs
   */
  getAllVIPs(): Array<{ viewer_id: string; granted_at: string }> {
    const db = this.getDatabase();
    return db.prepare(`
      SELECT viewer_id, granted_at 
      FROM viewer_roles 
      WHERE role_type = 'vip' AND revoked_at IS NULL
      ORDER BY granted_at DESC
    `).all() as Array<{ viewer_id: string; granted_at: string }>;
  }

  /**
   * Get all roles for a specific viewer
   */
  getViewerRoles(viewerId: string): ViewerRole[] {
    const db = this.getDatabase();
    return db.prepare(`
      SELECT * FROM viewer_roles 
      WHERE viewer_id = ? AND revoked_at IS NULL
      ORDER BY granted_at DESC
    `).all(viewerId) as ViewerRole[];
  }

  /**
   * Clear all revoked roles (cleanup old data)
   */
  cleanupRevokedRoles(olderThanDays: number = 30): number {
    const db = this.getDatabase();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const result = db.prepare(`
      DELETE FROM viewer_roles 
      WHERE revoked_at IS NOT NULL 
        AND revoked_at < ?
    `).run(cutoffDate.toISOString());
    
    return result.changes;
  }
}
