import { BaseRepository } from '../base-repository';
import { BrowserWindow } from 'electron';

export interface ViewerTTSRules {
  id: number;
  viewer_id: string;
  viewer_username?: string;
  viewer_display_name?: string | null;
  
  // Mute
  is_muted: boolean;
  mute_period_mins?: number | null;
  muted_at?: string | null;
  mute_expires_at?: string | null;
  
  // Cooldown
  has_cooldown: boolean;
  cooldown_gap_seconds?: number | null;
  cooldown_period_mins?: number | null;
  cooldown_set_at?: string | null;
  cooldown_expires_at?: string | null;
  
  created_at: string;
  updated_at: string;
}

export interface MuteConfig {
  mute_period_mins?: number | null; // null = permanent
}

export interface CooldownConfig {
  cooldown_gap_seconds: number;
  cooldown_period_mins?: number | null; // null = permanent
}

export class ViewerTTSRulesRepository extends BaseRepository<ViewerTTSRules> {
  private static mainWindow: BrowserWindow | null = null;

  static setMainWindow(mainWindow: BrowserWindow | null): void {
    ViewerTTSRulesRepository.mainWindow = mainWindow;
  }

  private static emitRestrictionUpdate(): void {
    if (ViewerTTSRulesRepository.mainWindow && !ViewerTTSRulesRepository.mainWindow.isDestroyed()) {
      try {
        ViewerTTSRulesRepository.mainWindow.webContents.send('viewer-tts-rules-updated');
      } catch (error) {
        console.error('[ViewerTTSRulesRepo] Error emitting update event:', error);
      }
    }
  }

  get tableName(): string {
    return 'viewer_tts_rules';
  }

  protected mapRow(row: any): ViewerTTSRules {
    return {
      id: row.id,
      viewer_id: row.viewer_id,
      is_muted: Boolean(row.is_muted),
      mute_period_mins: row.mute_period_mins,
      muted_at: row.muted_at,
      mute_expires_at: row.mute_expires_at,
      has_cooldown: Boolean(row.has_cooldown),
      cooldown_gap_seconds: row.cooldown_gap_seconds,
      cooldown_period_mins: row.cooldown_period_mins,
      cooldown_set_at: row.cooldown_set_at,
      cooldown_expires_at: row.cooldown_expires_at,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
  /**
   * Get rules for viewer
   */
  getByViewerId(viewerId: string): ViewerTTSRules | null {
    try {
      const db = this.getDatabase();
      const row = db.prepare(`
        SELECT * FROM viewer_tts_rules WHERE viewer_id = ?
      `).get(viewerId);

      return row ? this.mapRow(row) : null;
    } catch (error: any) {
      console.error('[ViewerTTSRulesRepo] Error getting rules:', error);
      return null;
    }
  }
  /**
   * Set mute for viewer
   */
  setMute(
    viewerId: string,
    config: MuteConfig
  ): { success: boolean; error?: string } {
    try {
      const db = this.getDatabase();
      const now = new Date();
      let expiresAt: string | null = null;

      if (config.mute_period_mins !== null && config.mute_period_mins !== undefined && config.mute_period_mins > 0) {
        const expiresDate = new Date(now.getTime() + config.mute_period_mins * 60000);
        expiresAt = expiresDate.toISOString();
      }

      // Upsert
      db.prepare(`
        INSERT INTO viewer_tts_rules (
          viewer_id, is_muted, mute_period_mins, muted_at, mute_expires_at
        ) VALUES (?, 1, ?, ?, ?)
        ON CONFLICT(viewer_id) DO UPDATE SET
          is_muted = 1,
          mute_period_mins = excluded.mute_period_mins,
          muted_at = excluded.muted_at,
          mute_expires_at = excluded.mute_expires_at,
          updated_at = CURRENT_TIMESTAMP
      `).run(
        viewerId,
        config.mute_period_mins || null,
        now.toISOString(),
        expiresAt
      );

      // Emit real-time update event
      ViewerTTSRulesRepository.emitRestrictionUpdate();

      return { success: true };
    } catch (error: any) {
      console.error('[ViewerTTSRulesRepo] Error setting mute:', error);
      return { success: false, error: error.message };
    }
  }
  /**
   * Remove mute from viewer
   */
  removeMute(viewerId: string): { success: boolean; error?: string } {
    try {
      const db = this.getDatabase();
      
      db.prepare(`
        UPDATE viewer_tts_rules
        SET is_muted = 0,
            mute_period_mins = NULL,
            muted_at = NULL,
            mute_expires_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE viewer_id = ?
      `).run(viewerId);

      // Emit real-time update event
      ViewerTTSRulesRepository.emitRestrictionUpdate();

      return { success: true };
    } catch (error: any) {
      console.error('[ViewerTTSRulesRepo] Error removing mute:', error);
      return { success: false, error: error.message };
    }
  }
  /**
   * Set cooldown for viewer
   */
  setCooldown(
    viewerId: string,
    config: CooldownConfig
  ): { success: boolean; error?: string } {
    try {
      const db = this.getDatabase();
      const now = new Date();
      let expiresAt: string | null = null;

      if (config.cooldown_period_mins !== null && config.cooldown_period_mins !== undefined && config.cooldown_period_mins > 0) {
        const expiresDate = new Date(now.getTime() + config.cooldown_period_mins * 60000);
        expiresAt = expiresDate.toISOString();
      }

      // Upsert
      db.prepare(`
        INSERT INTO viewer_tts_rules (
          viewer_id, has_cooldown, cooldown_gap_seconds, cooldown_period_mins, 
          cooldown_set_at, cooldown_expires_at
        ) VALUES (?, 1, ?, ?, ?, ?)
        ON CONFLICT(viewer_id) DO UPDATE SET
          has_cooldown = 1,
          cooldown_gap_seconds = excluded.cooldown_gap_seconds,
          cooldown_period_mins = excluded.cooldown_period_mins,
          cooldown_set_at = excluded.cooldown_set_at,
          cooldown_expires_at = excluded.cooldown_expires_at,
          updated_at = CURRENT_TIMESTAMP
      `).run(
        viewerId,
        config.cooldown_gap_seconds,
        config.cooldown_period_mins || null,
        now.toISOString(),
        expiresAt
      );

      // Emit real-time update event
      ViewerTTSRulesRepository.emitRestrictionUpdate();

      return { success: true };
    } catch (error: any) {
      console.error('[ViewerTTSRulesRepo] Error setting cooldown:', error);
      return { success: false, error: error.message };
    }
  }
  /**
   * Remove cooldown from viewer
   */
  removeCooldown(viewerId: string): { success: boolean; error?: string } {
    try {
      const db = this.getDatabase();
      
      db.prepare(`
        UPDATE viewer_tts_rules
        SET has_cooldown = 0,
            cooldown_gap_seconds = NULL,
            cooldown_period_mins = NULL,
            cooldown_set_at = NULL,
            cooldown_expires_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE viewer_id = ?
      `).run(viewerId);

      // Emit real-time update event
      ViewerTTSRulesRepository.emitRestrictionUpdate();

      return { success: true };
    } catch (error: any) {
      console.error('[ViewerTTSRulesRepo] Error removing cooldown:', error);
      return { success: false, error: error.message };
    }
  }
  /**
   * Clear all rules for a viewer
   */
  clearRules(viewerId: string): { success: boolean; error?: string } {
    try {
      const db = this.getDatabase();
      
      db.prepare(`
        DELETE FROM viewer_tts_rules WHERE viewer_id = ?
      `).run(viewerId);

      // Emit real-time update event
      ViewerTTSRulesRepository.emitRestrictionUpdate();

      return { success: true };
    } catch (error: any) {
      console.error('[ViewerTTSRulesRepo] Error clearing rules:', error);
      return { success: false, error: error.message };
    }
  }
  /**
   * Clean up expired rules (for background job)
   */
  cleanupExpiredRules(): number {
    try {
      const db = this.getDatabase();
      const now = new Date().toISOString();

      // Clear expired mutes
      const mutesCleared = db.prepare(`
        UPDATE viewer_tts_rules
        SET is_muted = 0,
            mute_period_mins = NULL,
            muted_at = NULL,
            mute_expires_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE is_muted = 1 
          AND mute_expires_at IS NOT NULL 
          AND mute_expires_at <= ?
      `).run(now);

      // Clear expired cooldowns
      const cooldownsCleared = db.prepare(`
        UPDATE viewer_tts_rules
        SET has_cooldown = 0,
            cooldown_gap_seconds = NULL,
            cooldown_period_mins = NULL,
            cooldown_set_at = NULL,
            cooldown_expires_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE has_cooldown = 1 
          AND cooldown_expires_at IS NOT NULL 
          AND cooldown_expires_at <= ?
      `).run(now);

      const totalCleared = mutesCleared.changes + cooldownsCleared.changes;
      
      if (totalCleared > 0) {
        console.log(`[ViewerTTSRulesRepo] Cleaned up ${totalCleared} expired rules`);
        // Emit update event on cleanup as well
        ViewerTTSRulesRepository.emitRestrictionUpdate();
      }

      return totalCleared;
    } catch (error: any) {
      console.error('[ViewerTTSRulesRepo] Error cleaning expired rules:', error);
      return 0;
    }
  }
  /**
   * Get all currently muted viewers
   */
  getAllMuted(): ViewerTTSRules[] {
    try {
      const db = this.getDatabase();
      const rows = db.prepare(`
        SELECT 
          vtr.*,
          v.username as viewer_username,
          v.display_name as viewer_display_name
        FROM viewer_tts_rules vtr
        LEFT JOIN viewers v ON vtr.viewer_id = v.id
        WHERE vtr.is_muted = 1 
        ORDER BY vtr.mute_expires_at ASC NULLS LAST
      `).all() as any[];

      return rows.map(row => ({
        ...this.mapRow(row),
        viewer_username: row.viewer_username,
        viewer_display_name: row.viewer_display_name
      }));
    } catch (error: any) {
      console.error('[ViewerTTSRulesRepo] Error getting muted viewers:', error);
      return [];
    }
  }
  /**
   * Get all viewers with cooldowns
   */
  getAllWithCooldown(): ViewerTTSRules[] {
    try {
      const db = this.getDatabase();
      const rows = db.prepare(`
        SELECT 
          vtr.*,
          v.username as viewer_username,
          v.display_name as viewer_display_name
        FROM viewer_tts_rules vtr
        LEFT JOIN viewers v ON vtr.viewer_id = v.id
        WHERE vtr.has_cooldown = 1 
        ORDER BY vtr.cooldown_expires_at ASC NULLS LAST
      `).all() as any[];

      return rows.map(row => ({
        ...this.mapRow(row),
        viewer_username: row.viewer_username,
        viewer_display_name: row.viewer_display_name
      }));
    } catch (error: any) {
      console.error('[ViewerTTSRulesRepo] Error getting cooldown viewers:', error);
      return [];
    }
  }
}
