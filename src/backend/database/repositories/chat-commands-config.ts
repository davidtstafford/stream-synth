import { BaseRepository } from '../base-repository';
import Database from 'better-sqlite3';

export interface ChatCommandConfig {
  id: number;
  command_name: string;
  command_prefix: string;
  enabled: boolean;
  permission_level: 'viewer' | 'moderator' | 'broadcaster';
  rate_limit_seconds: number;
  custom_response: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatCommandUsage {
  id: number;
  command_name: string;
  viewer_id: string;
  viewer_username: string;
  executed_at: string;
  success: boolean;
  error_message: string | null;
}

export interface ChatCommandConfigInput {
  command_name: string;
  command_prefix?: string;
  enabled?: boolean;
  permission_level?: 'viewer' | 'moderator' | 'broadcaster';
  rate_limit_seconds?: number;
  custom_response?: string | null;
}

export class ChatCommandsConfigRepository extends BaseRepository<ChatCommandConfig> {
  get tableName(): string {
    return 'chat_commands_config';
  }

  protected mapRow(row: any): ChatCommandConfig {
    return {
      id: row.id,
      command_name: row.command_name,
      command_prefix: row.command_prefix,
      enabled: Boolean(row.enabled),
      permission_level: row.permission_level,
      rate_limit_seconds: row.rate_limit_seconds,
      custom_response: row.custom_response,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Get all command configurations
   */
  getAll(): ChatCommandConfig[] {
    const db = this.getDatabase();
    const rows = db.prepare(`
      SELECT * FROM chat_commands_config
      ORDER BY permission_level, command_name
    `).all();

    return rows.map((row: any) => this.mapRow(row));
  }

  /**
   * Get enabled commands only
   */
  getEnabled(): ChatCommandConfig[] {
    const db = this.getDatabase();
    const rows = db.prepare(`
      SELECT * FROM chat_commands_config
      WHERE enabled = 1
      ORDER BY permission_level, command_name
    `).all();

    return rows.map((row: any) => this.mapRow(row));
  }

  /**
   * Get command by name
   */
  getByName(commandName: string): ChatCommandConfig | null {
    const db = this.getDatabase();
    const row = db.prepare(`
      SELECT * FROM chat_commands_config
      WHERE command_name = ?
    `).get(commandName);

    return row ? this.mapRow(row) : null;
  }

  /**
   * Update command configuration
   */
  updateCommand(commandName: string, updates: Partial<ChatCommandConfigInput>): void {
    const db = this.getDatabase();

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.command_prefix !== undefined) {
      fields.push('command_prefix = ?');
      values.push(updates.command_prefix);
    }
    if (updates.enabled !== undefined) {
      fields.push('enabled = ?');
      values.push(updates.enabled ? 1 : 0);
    }
    if (updates.permission_level !== undefined) {
      fields.push('permission_level = ?');
      values.push(updates.permission_level);
    }
    if (updates.rate_limit_seconds !== undefined) {
      fields.push('rate_limit_seconds = ?');
      values.push(updates.rate_limit_seconds);
    }
    if (updates.custom_response !== undefined) {
      fields.push('custom_response = ?');
      values.push(updates.custom_response || null);
    }

    if (fields.length === 0) {
      console.warn('[ChatCommandsConfig] No fields to update');
      return;
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(commandName);

    db.prepare(`
      UPDATE chat_commands_config
      SET ${fields.join(', ')}
      WHERE command_name = ?
    `).run(...values);

    console.log(`[ChatCommandsConfig] Updated command: ${commandName}`);
  }

  /**
   * Record command usage
   */
  recordUsage(
    commandName: string,
    viewerId: string,
    viewerUsername: string,
    success: boolean,
    errorMessage?: string
  ): void {
    const db = this.getDatabase();
    
    db.prepare(`
      INSERT INTO chat_command_usage (
        command_name, viewer_id, viewer_username, success, error_message
      ) VALUES (?, ?, ?, ?, ?)
    `).run(commandName, viewerId, viewerUsername, success ? 1 : 0, errorMessage || null);

    console.log(`[ChatCommandsConfig] Recorded usage: ${commandName} by ${viewerUsername} (success: ${success})`);
  }

  /**
   * Get command usage statistics
   */
  getUsageStats(commandName?: string, limit: number = 100): ChatCommandUsage[] {
    const db = this.getDatabase();
    
    let query = `
      SELECT * FROM chat_command_usage
    `;
    
    const params: any[] = [];
    
    if (commandName) {
      query += ` WHERE command_name = ?`;
      params.push(commandName);
    }
    
    query += ` ORDER BY executed_at DESC LIMIT ?`;
    params.push(limit);

    const rows = db.prepare(query).all(...params);

    return rows.map((row: any) => ({
      id: row.id,
      command_name: row.command_name,
      viewer_id: row.viewer_id,
      viewer_username: row.viewer_username,
      executed_at: row.executed_at,
      success: Boolean(row.success),
      error_message: row.error_message,
    }));
  }

  /**
   * Get usage count for a specific command
   */
  getUsageCount(commandName: string, since?: Date): number {
    const db = this.getDatabase();
    
    let query = `SELECT COUNT(*) as count FROM chat_command_usage WHERE command_name = ?`;
    const params: any[] = [commandName];
    
    if (since) {
      query += ` AND executed_at >= ?`;
      params.push(since.toISOString());
    }

    const result = db.prepare(query).get(...params) as { count: number };
    return result.count;
  }

  /**
   * Clear old usage records (cleanup)
   */
  cleanupOldUsage(daysToKeep: number = 30): void {
    const db = this.getDatabase();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = db.prepare(`
      DELETE FROM chat_command_usage
      WHERE executed_at < ?
    `).run(cutoffDate.toISOString());

    console.log(`[ChatCommandsConfig] Cleaned up ${result.changes} old usage records`);
  }
}
