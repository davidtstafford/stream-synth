import Database from 'better-sqlite3';

export interface ViewerTTSRule {
  id: number;
  username: string;
  customVoiceId: number | null;
  pitchOverride: number | null;
  rateOverride: number | null;
  isMuted: boolean;
  mutedUntil: string | null;
  cooldownEnabled: boolean;
  cooldownSeconds: number | null;
  cooldownUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ViewerTTSRuleInput {
  username: string;
  customVoiceId?: number | null;
  pitchOverride?: number | null;
  rateOverride?: number | null;
  isMuted?: boolean;
  mutedUntil?: string | null;
  cooldownEnabled?: boolean;
  cooldownSeconds?: number | null;
  cooldownUntil?: string | null;
}

export class ViewerRulesRepository {
  constructor(private db: Database.Database) {}

  /**
   * Get viewer TTS rule by username
   */
  getByUsername(username: string): ViewerTTSRule | null {
    const stmt = this.db.prepare(`
      SELECT 
        id,
        username,
        custom_voice_id as customVoiceId,
        pitch_override as pitchOverride,
        rate_override as rateOverride,
        is_muted as isMuted,
        muted_until as mutedUntil,
        cooldown_enabled as cooldownEnabled,
        cooldown_seconds as cooldownSeconds,
        cooldown_until as cooldownUntil,
        created_at as createdAt,
        updated_at as updatedAt
      FROM viewer_tts_rules
      WHERE username = ?
    `);
    
    const row = stmt.get(username) as any;
    
    if (!row) {
      return null;
    }
    
    return {
      ...row,
      isMuted: Boolean(row.isMuted),
      cooldownEnabled: Boolean(row.cooldownEnabled)
    };
  }

  /**
   * Create a new viewer TTS rule
   */
  create(input: ViewerTTSRuleInput): ViewerTTSRule {
    const stmt = this.db.prepare(`
      INSERT INTO viewer_tts_rules (
        username,
        custom_voice_id,
        pitch_override,
        rate_override,
        is_muted,
        muted_until,
        cooldown_enabled,
        cooldown_seconds,
        cooldown_until
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      input.username,
      input.customVoiceId ?? null,
      input.pitchOverride ?? null,
      input.rateOverride ?? null,
      input.isMuted ? 1 : 0,
      input.mutedUntil ?? null,
      input.cooldownEnabled ? 1 : 0,
      input.cooldownSeconds ?? null,
      input.cooldownUntil ?? null
    );
    
    const created = this.getByUsername(input.username);
    if (!created) {
      throw new Error('Failed to create viewer rule');
    }
    
    return created;
  }

  /**
   * Update an existing viewer TTS rule
   */
  update(username: string, updates: Partial<Omit<ViewerTTSRuleInput, 'username'>>): ViewerTTSRule | null {
    const existing = this.getByUsername(username);
    if (!existing) {
      return null;
    }
    
    // Build dynamic update query based on provided fields
    const fields: string[] = [];
    const values: any[] = [];
    
    if (updates.customVoiceId !== undefined) {
      fields.push('custom_voice_id = ?');
      values.push(updates.customVoiceId);
    }
    
    if (updates.pitchOverride !== undefined) {
      fields.push('pitch_override = ?');
      values.push(updates.pitchOverride);
    }
    
    if (updates.rateOverride !== undefined) {
      fields.push('rate_override = ?');
      values.push(updates.rateOverride);
    }
    
    if (updates.isMuted !== undefined) {
      fields.push('is_muted = ?');
      values.push(updates.isMuted ? 1 : 0);
    }
    
    if (updates.mutedUntil !== undefined) {
      fields.push('muted_until = ?');
      values.push(updates.mutedUntil);
    }
    
    if (updates.cooldownEnabled !== undefined) {
      fields.push('cooldown_enabled = ?');
      values.push(updates.cooldownEnabled ? 1 : 0);
    }
    
    if (updates.cooldownSeconds !== undefined) {
      fields.push('cooldown_seconds = ?');
      values.push(updates.cooldownSeconds);
    }
    
    if (updates.cooldownUntil !== undefined) {
      fields.push('cooldown_until = ?');
      values.push(updates.cooldownUntil);
    }
    
    if (fields.length === 0) {
      return existing; // No updates to apply
    }
    
    // Always update the updated_at timestamp
    fields.push("updated_at = datetime('now')");
    values.push(username); // For WHERE clause
    
    const stmt = this.db.prepare(`
      UPDATE viewer_tts_rules
      SET ${fields.join(', ')}
      WHERE username = ?
    `);
    
    stmt.run(...values);
    
    return this.getByUsername(username);
  }

  /**
   * Delete a viewer TTS rule by username
   */
  delete(username: string): boolean {
    const stmt = this.db.prepare('DELETE FROM viewer_tts_rules WHERE username = ?');
    const result = stmt.run(username);
    return result.changes > 0;
  }

  /**
   * Get all viewer TTS rules
   */
  getAll(): ViewerTTSRule[] {
    const stmt = this.db.prepare(`
      SELECT 
        id,
        username,
        custom_voice_id as customVoiceId,
        pitch_override as pitchOverride,
        rate_override as rateOverride,
        is_muted as isMuted,
        muted_until as mutedUntil,
        cooldown_enabled as cooldownEnabled,
        cooldown_seconds as cooldownSeconds,
        cooldown_until as cooldownUntil,
        created_at as createdAt,
        updated_at as updatedAt
      FROM viewer_tts_rules
      ORDER BY username ASC
    `);
    
    const rows = stmt.all() as any[];
    
    return rows.map(row => ({
      ...row,
      isMuted: Boolean(row.isMuted),
      cooldownEnabled: Boolean(row.cooldownEnabled)
    }));
  }
}
