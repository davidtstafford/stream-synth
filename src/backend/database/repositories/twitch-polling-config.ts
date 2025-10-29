import { BaseRepository } from '../base-repository';

export interface TwitchPollingConfig {
  api_type: 'role_sync';
  interval_minutes: number;
  enabled: boolean;
  last_poll_at: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export class TwitchPollingConfigRepository extends BaseRepository<TwitchPollingConfig> {
  get tableName(): string {
    return 'twitch_polling_config';
  }

  /**
   * Get polling config for a specific API type
   */
  getConfig(apiType: TwitchPollingConfig['api_type']): TwitchPollingConfig | null {
    return this.getById(apiType, 'api_type');
  }

  /**
   * Get all polling configs
   */
  getAllConfigs(): TwitchPollingConfig[] {
    return this.query<TwitchPollingConfig>(
      `SELECT * FROM ${this.tableName} ORDER BY api_type`
    );
  }

  /**
   * Update polling interval for a specific API type
   */
  updateInterval(apiType: TwitchPollingConfig['api_type'], intervalMinutes: number): void {
    if (intervalMinutes < 5 || intervalMinutes > 120) {
      throw new Error('Interval must be between 5 and 120 minutes');
    }

    const db = this.getDatabase();
    const stmt = db.prepare(`
      UPDATE ${this.tableName}
      SET interval_minutes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE api_type = ?
    `);
    
    const result = stmt.run(intervalMinutes, apiType);
    
    if (result.changes === 0) {
      throw new Error(`API type '${apiType}' not found`);
    }
  }

  /**
   * Enable or disable polling for a specific API type
   */
  setEnabled(apiType: TwitchPollingConfig['api_type'], enabled: boolean): void {
    const db = this.getDatabase();
    const stmt = db.prepare(`
      UPDATE ${this.tableName}
      SET enabled = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE api_type = ?
    `);
    
    stmt.run(enabled ? 1 : 0, apiType);
  }

  /**
   * Update last poll timestamp
   */
  updateLastPoll(apiType: TwitchPollingConfig['api_type']): void {
    const db = this.getDatabase();
    const stmt = db.prepare(`
      UPDATE ${this.tableName}
      SET last_poll_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE api_type = ?
    `);
    
    stmt.run(apiType);
  }

  /**
   * Get interval in milliseconds for a specific API type
   */
  getIntervalMs(apiType: TwitchPollingConfig['api_type']): number {
    const config = this.getConfig(apiType);
    if (!config || !config.enabled) {
      return 0; // Disabled
    }
    return config.interval_minutes * 60 * 1000;
  }
}
