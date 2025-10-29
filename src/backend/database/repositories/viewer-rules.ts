import { BaseRepository } from '../base-repository';

export interface ViewerVoicePreference {
  id: number;
  viewer_id: string;
  voice_id: string;
  provider: string;
  pitch: number;
  speed: number;
  created_at: string;
  updated_at: string;
}

export interface ViewerVoicePreferenceWithInfo extends ViewerVoicePreference {
  display_name: string | null;
  username: string;
  voice_name: string | null;
}

export class ViewerRulesRepository extends BaseRepository<ViewerVoicePreference> {
  get tableName(): string {
    return 'viewer_voice_preferences';
  }

  /**
   * Get voice preference for a specific viewer
   */
  getByViewerId(viewerId: string): ViewerVoicePreference | null {
    const db = this.getDatabase();
    return db.prepare(`
      SELECT * FROM viewer_voice_preferences 
      WHERE viewer_id = ?
    `).get(viewerId) as ViewerVoicePreference | null;
  }

  /**
   * Upsert (insert or update) a viewer's voice preference
   */
  upsert(pref: Omit<ViewerVoicePreference, 'id' | 'created_at' | 'updated_at'>): void {
    const db = this.getDatabase();
    
    db.prepare(`
      INSERT INTO viewer_voice_preferences (viewer_id, voice_id, provider, pitch, speed)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(viewer_id) DO UPDATE SET
        voice_id = excluded.voice_id,
        provider = excluded.provider,
        pitch = excluded.pitch,
        speed = excluded.speed,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      pref.viewer_id,
      pref.voice_id,
      pref.provider,
      pref.pitch,
      pref.speed
    );
  }

  /**
   * Delete a viewer's voice preference
   */
  deleteByViewerId(viewerId: string): void {
    const db = this.getDatabase();
    db.prepare('DELETE FROM viewer_voice_preferences WHERE viewer_id = ?').run(viewerId);
  }

  /**
   * Get all viewer voice preferences with viewer display names
   */
  getAllWithViewerInfo(): ViewerVoicePreferenceWithInfo[] {
    const db = this.getDatabase();
    return db.prepare(`
      SELECT 
        vvp.*,
        v.display_name,
        v.username,
        COALESCE(
          av.name,
          gv.name,
          wv.name,
          vvp.voice_id
        ) as voice_name
      FROM viewer_voice_preferences vvp
      INNER JOIN viewers v ON vvp.viewer_id = v.id
      LEFT JOIN azure_voices av ON vvp.voice_id = av.voice_id AND vvp.provider = 'azure'
      LEFT JOIN google_voices gv ON vvp.voice_id = gv.voice_id AND vvp.provider = 'google'
      LEFT JOIN webspeech_voices wv ON vvp.voice_id = wv.voice_id AND vvp.provider = 'webspeech'
      ORDER BY v.username
    `).all() as ViewerVoicePreferenceWithInfo[];
  }

  /**
   * Search viewers by username or display name
   * Returns viewers with their voice preferences if they exist
   */
  search(query: string): ViewerVoicePreferenceWithInfo[] {
    const db = this.getDatabase();
    const searchParam = `%${query}%`;
    
    return db.prepare(`
      SELECT 
        vvp.*,
        v.display_name,
        v.username,
        COALESCE(
          av.name,
          gv.name,
          wv.name,
          vvp.voice_id
        ) as voice_name
      FROM viewer_voice_preferences vvp
      INNER JOIN viewers v ON vvp.viewer_id = v.id
      LEFT JOIN azure_voices av ON vvp.voice_id = av.voice_id AND vvp.provider = 'azure'
      LEFT JOIN google_voices gv ON vvp.voice_id = gv.voice_id AND vvp.provider = 'google'
      LEFT JOIN webspeech_voices wv ON vvp.voice_id = wv.voice_id AND vvp.provider = 'webspeech'
      WHERE v.username LIKE ? OR v.display_name LIKE ?
      ORDER BY v.username
      LIMIT 50
    `).all(searchParam, searchParam) as ViewerVoicePreferenceWithInfo[];
  }

  /**
   * Count total number of custom voice rules
   */
  count(): number {
    const db = this.getDatabase();
    const result = db.prepare('SELECT COUNT(*) as count FROM viewer_voice_preferences').get() as { count: number };
    return result.count;
  }

  /**
   * Check if a viewer has a custom voice preference
   */
  hasPreference(viewerId: string): boolean {
    return this.getByViewerId(viewerId) !== null;
  }
}
