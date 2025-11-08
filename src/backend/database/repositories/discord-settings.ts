import { BaseRepository } from '../base-repository';

export interface DiscordSetting {
  id: number;
  bot_token: string | null;
  bot_id: string | null;
  bot_status: string;
  last_connected_at: string | null;
  last_disconnected_at: string | null;
  auto_start_enabled: number;
  created_at: string;
  updated_at: string;
}

export class DiscordSettingsRepository extends BaseRepository<DiscordSetting> {
  get tableName(): string {
    return 'discord_settings';
  }

  /**
   * Get the singleton Discord settings record (id = 1)
   */
  getSettings(): DiscordSetting {
    const row = this.getById(1, 'id');
    if (!row) {
      // Create default settings if not exists
      this.initializeSettings();
      return this.getById(1, 'id') as DiscordSetting;
    }
    return row;
  }

  /**
   * Initialize default settings if not exists
   */
  private initializeSettings(): void {
    const db = this.getDatabase();
    db.prepare(`
      INSERT OR IGNORE INTO discord_settings (id, bot_status)
      VALUES (1, 'disconnected')
    `).run();
  }

  /**
   * Update bot token (encrypted)
   */
  updateBotToken(encryptedToken: string | null): void {
    const db = this.getDatabase();
    db.prepare(`
      UPDATE discord_settings
      SET bot_token = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(encryptedToken);
  }

  /**
   * Update bot status
   */
  updateBotStatus(status: string): void {
    const db = this.getDatabase();
    db.prepare(`
      UPDATE discord_settings
      SET bot_status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(status);
  }

  /**
   * Update bot ID
   */
  updateBotId(botId: string | null): void {
    const db = this.getDatabase();
    db.prepare(`
      UPDATE discord_settings
      SET bot_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(botId);
  }

  /**
   * Update last connected time
   */
  updateLastConnectedAt(): void {
    const db = this.getDatabase();
    db.prepare(`
      UPDATE discord_settings
      SET last_connected_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run();
  }

  /**
   * Update last disconnected time
   */
  updateLastDisconnectedAt(): void {
    const db = this.getDatabase();
    db.prepare(`
      UPDATE discord_settings
      SET last_disconnected_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run();
  }

  /**
   * Update auto-start setting
   */
  updateAutoStartEnabled(enabled: boolean): void {
    const db = this.getDatabase();
    db.prepare(`
      UPDATE discord_settings
      SET auto_start_enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(enabled ? 1 : 0);
  }

  /**
   * Clear bot token (logout)
   */
  clearBotToken(): void {
    this.updateBotToken(null);
  }
}
