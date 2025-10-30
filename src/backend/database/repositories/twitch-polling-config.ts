import { BaseRepository } from '../base-repository';

export type ApiType = 'role_sync' | 'followers' | 'moderation';
export type IntervalUnit = 'seconds' | 'minutes' | 'hours';

export interface TwitchPollingConfig {
  api_type: ApiType;
  interval_value: number;
  min_interval: number;
  max_interval: number;
  interval_units: IntervalUnit;
  step: number;
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
  getConfig(apiType: ApiType): TwitchPollingConfig | null {
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
  updateInterval(apiType: ApiType, intervalValue: number): void {
    // Get config to validate against its specific min/max
    const config = this.getConfig(apiType);
    if (!config) {
      throw new Error(`API type '${apiType}' not found`);
    }

    if (intervalValue < config.min_interval || intervalValue > config.max_interval) {
      throw new Error(
        `Interval must be between ${config.min_interval} and ${config.max_interval} ${config.interval_units} for ${apiType}`
      );
    }

    const db = this.getDatabase();
    const stmt = db.prepare(`
      UPDATE ${this.tableName}
      SET interval_value = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE api_type = ?
    `);
    
    const result = stmt.run(intervalValue, apiType);
    
    if (result.changes === 0) {
      throw new Error(`API type '${apiType}' not found`);
    }
  }

  /**
   * Enable or disable polling for a specific API type
   */
  setEnabled(apiType: ApiType, enabled: boolean): void {
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
  updateLastPoll(apiType: ApiType): void {
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
  getIntervalMs(apiType: ApiType): number {
    const config = this.getConfig(apiType);
    if (!config || !config.enabled) {
      return 0; // Disabled
    }

    // Convert to milliseconds based on units
    let ms = config.interval_value;
    switch (config.interval_units) {
      case 'seconds':
        ms *= 1000;
        break;      case 'minutes':
        ms *= 60 * 1000;
        break;
      case 'hours':
        ms *= 60 * 60 * 1000;
        break;
    }
    return ms;
  }
}
