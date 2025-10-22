import { getDatabase } from '../connection';

export interface AppSetting {
  key: string;
  value: string;
  updated_at: string;
}

export class SettingsRepository {
  get(key: string): string | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT value FROM app_settings WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;
    return row?.value || null;
  }

  set(key: string, value: string): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(key, value);
  }

  delete(key: string): void {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM app_settings WHERE key = ?');
    stmt.run(key);
  }

  getAll(): AppSetting[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM app_settings ORDER BY key');
    return stmt.all() as AppSetting[];
  }
}
