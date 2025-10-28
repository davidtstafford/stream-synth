import { BaseRepository } from '../base-repository';

export interface AppSetting {
  key: string;
  value: string;
  updated_at: string;
}

export class SettingsRepository extends BaseRepository<AppSetting> {
  get tableName(): string {
    return 'app_settings';
  }

  get(key: string): string | null {
    const row = this.getById(key, 'key');
    return row?.value || null;
  }

  set(key: string, value: string): void {
    const db = this.getDatabase();
    const stmt = db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(key, value);
  }

  deleteSetting(key: string): void {
    this.deleteById(key, 'key');
  }

  getAll(): AppSetting[] {
    const rows = this.query<AppSetting>(
      `SELECT * FROM ${this.tableName} ORDER BY key`
    );
    return rows;
  }
}
