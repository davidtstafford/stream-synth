import { BaseRepository } from '../base-repository';

export interface TTSAccessConfig {
  id: number;
  access_mode: 'access_all' | 'limited_access' | 'premium_voice_access';
  
  // Limited Access Rules
  limited_allow_subscribers: number;
  limited_deny_gifted_subs: number;
  limited_allow_vip: number;
  limited_allow_mod: number;
  limited_redeem_name: string | null;
  limited_redeem_duration_mins: number | null;
  
  // Premium Voice Access Rules
  premium_allow_subscribers: number;
  premium_deny_gifted_subs: number;
  premium_allow_vip: number;
  premium_allow_mod: number;
  premium_redeem_name: string | null;
  premium_redeem_duration_mins: number | null;
  
  created_at: string;
  updated_at: string;
}

export class TTSAccessRepository extends BaseRepository<TTSAccessConfig> {
  get tableName(): string {
    return 'tts_access_config';
  }

  /**
   * Get the TTS access configuration (always returns the single row)
   */
  getConfig(): TTSAccessConfig {
    const db = this.getDatabase();
    const config = db.prepare('SELECT * FROM tts_access_config WHERE id = 1').get() as TTSAccessConfig;
    
    if (!config) {
      // Should never happen due to default insert in migration, but just in case
      db.prepare(`
        INSERT INTO tts_access_config (id, access_mode) VALUES (1, 'access_all')
      `).run();
      return this.getConfig();
    }
    
    return config;
  }

  /**
   * Save/update the TTS access configuration
   */
  saveConfig(config: Partial<TTSAccessConfig>): void {
    const db = this.getDatabase();
    
    // Build dynamic UPDATE query based on provided fields
    const fields = Object.keys(config).filter(key => key !== 'id' && key !== 'created_at');
    
    if (fields.length === 0) {
      return;
    }

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => (config as any)[field]);
    
    db.prepare(`
      UPDATE tts_access_config 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(...values);
  }

  /**
   * Validate configuration before saving
   * Returns error message or null if valid
   */
  validateConfig(config: Partial<TTSAccessConfig>): string | null {
    // Validate access_mode
    if (config.access_mode) {
      const validModes = ['access_all', 'limited_access', 'premium_voice_access'];
      if (!validModes.includes(config.access_mode)) {
        return `Invalid access_mode. Must be one of: ${validModes.join(', ')}`;
      }
    }

    // Validate redeem duration (must be positive if provided)
    if (config.limited_redeem_duration_mins !== undefined && 
        config.limited_redeem_duration_mins !== null &&
        config.limited_redeem_duration_mins < 1) {
      return 'Limited redeem duration must be at least 1 minute';
    }

    if (config.premium_redeem_duration_mins !== undefined && 
        config.premium_redeem_duration_mins !== null &&
        config.premium_redeem_duration_mins < 1) {
      return 'Premium redeem duration must be at least 1 minute';
    }

    // Validate redeem name (if duration is set, name must be set too)
    if (config.limited_redeem_duration_mins && !config.limited_redeem_name) {
      return 'Limited redeem name is required when duration is set';
    }

    if (config.premium_redeem_duration_mins && !config.premium_redeem_name) {
      return 'Premium redeem name is required when duration is set';
    }

    return null;
  }

  /**
   * Reset configuration to defaults
   */
  resetToDefaults(): void {
    const db = this.getDatabase();
    db.prepare(`
      UPDATE tts_access_config 
      SET 
        access_mode = 'access_all',
        limited_allow_subscribers = 1,
        limited_deny_gifted_subs = 0,
        limited_allow_vip = 0,
        limited_redeem_name = NULL,
        limited_redeem_duration_mins = NULL,
        premium_allow_subscribers = 1,
        premium_deny_gifted_subs = 0,
        premium_allow_vip = 0,
        premium_redeem_name = NULL,
        premium_redeem_duration_mins = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run();
  }
}
