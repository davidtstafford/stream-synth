/**
 * Viewer Entrance Sounds Repository
 * 
 * Manages custom sound files that play when a viewer sends their first message
 * of the current app session. Similar to Twitch's entrance sounds for VIPs/subs,
 * but allows assignment to any viewer.
 */

import { BaseRepository } from '../base-repository';

export interface ViewerEntranceSound {
  id: number;
  viewer_id: string;
  viewer_username: string;
  sound_file_path: string;
  volume: number; // 0-100
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export class ViewerEntranceSoundsRepository extends BaseRepository<ViewerEntranceSound> {
  get tableName(): string {
    return 'viewer_entrance_sounds';
  }

  /**
   * Ensure the table exists with the correct schema
   */
  ensureTable(): void {
    const db = this.getDatabase();
    
    db.exec(`
      CREATE TABLE IF NOT EXISTS viewer_entrance_sounds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        viewer_id TEXT NOT NULL UNIQUE,
        viewer_username TEXT NOT NULL,
        sound_file_path TEXT NOT NULL,
        volume INTEGER DEFAULT 100,
        enabled INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_viewer_entrance_sounds_viewer_id 
        ON viewer_entrance_sounds(viewer_id);
      
      CREATE INDEX IF NOT EXISTS idx_viewer_entrance_sounds_enabled 
        ON viewer_entrance_sounds(enabled);
    `);

    console.log('[ViewerEntranceSounds] Table ensured');
  }

  /**
   * Get entrance sound for a specific viewer
   */
  getByViewerId(viewerId: string): ViewerEntranceSound | null {
    const db = this.getDatabase();
    
    return db.prepare(`
      SELECT * FROM viewer_entrance_sounds 
      WHERE viewer_id = ? AND enabled = 1
    `).get(viewerId) as ViewerEntranceSound | null;
  }

  /**
   * Get all entrance sounds
   */
  getAll(): ViewerEntranceSound[] {
    const db = this.getDatabase();
    
    const result = db.prepare(`
      SELECT * FROM viewer_entrance_sounds 
      ORDER BY viewer_username ASC
    `).all();
    
    console.log('[ViewerEntranceSoundsRepo] getAll() result:', result, 'Type:', typeof result);
    return Array.isArray(result) ? result as ViewerEntranceSound[] : [];
  }

  /**
   * Get all enabled entrance sounds
   */
  getAllEnabled(): ViewerEntranceSound[] {
    const db = this.getDatabase();
    
    return db.prepare(`
      SELECT * FROM viewer_entrance_sounds 
      WHERE enabled = 1
      ORDER BY viewer_username ASC
    `).all() as ViewerEntranceSound[];
  }

    /**
   * Upsert (insert or update) a viewer's entrance sound
   */
  upsert(sound: Omit<ViewerEntranceSound, 'id' | 'created_at' | 'updated_at'>): void {
    const db = this.getDatabase();
    
    db.prepare(`
      INSERT INTO viewer_entrance_sounds (viewer_id, viewer_username, sound_file_path, volume, enabled)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(viewer_id) DO UPDATE SET
        viewer_username = excluded.viewer_username,
        sound_file_path = excluded.sound_file_path,
        volume = excluded.volume,
        enabled = excluded.enabled,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      sound.viewer_id,
      sound.viewer_username,
      sound.sound_file_path,
      sound.volume,
      sound.enabled ? 1 : 0
    );
  }

  /**
   * Set enabled status for a viewer's entrance sound
   */
  setEnabled(viewerId: string, enabled: boolean): void {
    const db = this.getDatabase();
    
    db.prepare(`
      UPDATE viewer_entrance_sounds 
      SET enabled = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE viewer_id = ?
    `).run(enabled ? 1 : 0, viewerId);
  }

  /**
   * Update volume for a viewer
   */
  setVolume(viewerId: string, volume: number): void {
    const db = this.getDatabase();
    
    db.prepare(`
      UPDATE viewer_entrance_sounds 
      SET volume = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE viewer_id = ?
    `).run(volume, viewerId);
  }

  /**
   * Delete a viewer's entrance sound
   */
  deleteByViewerId(viewerId: string): void {
    const db = this.getDatabase();
    
    db.prepare(`
      DELETE FROM viewer_entrance_sounds 
      WHERE viewer_id = ?
    `).run(viewerId);
  }

  /**
   * Get count of configured entrance sounds
   */
  getCount(): number {
    const db = this.getDatabase();
    
    const result = db.prepare(`
      SELECT COUNT(*) as count 
      FROM viewer_entrance_sounds
    `).get() as { count: number };
    
    return result.count;
  }

  /**
   * Get count of enabled entrance sounds
   */
  getEnabledCount(): number {
    const db = this.getDatabase();
    
    const result = db.prepare(`
      SELECT COUNT(*) as count 
      FROM viewer_entrance_sounds 
      WHERE enabled = 1
    `).get() as { count: number };
    
    return result.count;
  }
}
