import { BaseRepository } from '../base-repository';
import { BrowserWindow } from 'electron';

export interface TTSSettingRow {
  key: string;
  value: string;
}

/**
 * TTSRepository - Manages TTS configuration and viewer TTS preferences
 */
export class TTSRepository extends BaseRepository<TTSSettingRow> {
  private static mainWindow: BrowserWindow | null = null;

  static setMainWindow(mainWindow: BrowserWindow | null): void {
    console.log(`[TTSRepository] setMainWindow called: ${mainWindow ? 'window set' : 'window cleared'}`);
    TTSRepository.mainWindow = mainWindow;
  }

  get tableName(): string {
    return 'tts_settings';
  }

  /**
   * Get all TTS settings as an object
   */
  getSettings(): Record<string, any> {
    const db = this.getDatabase();
    const rows = db.prepare('SELECT key, value FROM tts_settings').all() as TTSSettingRow[];
    
    const settings: Record<string, any> = {};
    for (const row of rows) {
      // Parse booleans and numbers
      if (row.value === 'true') settings[row.key] = true;
      else if (row.value === 'false') settings[row.key] = false;
      else if (!isNaN(Number(row.value)) && row.value !== '') settings[row.key] = Number(row.value);
      else settings[row.key] = row.value;
    }
    
    return settings;
  }

  /**
   * Get a single setting by key
   */
  getSetting(key: string): any {
    const db = this.getDatabase();
    const row = db.prepare('SELECT value FROM tts_settings WHERE key = ?').get(key) as TTSSettingRow | undefined;
    
    if (!row) return null;
    
    // Parse booleans and numbers
    if (row.value === 'true') return true;
    if (row.value === 'false') return false;
    if (!isNaN(Number(row.value)) && row.value !== '') return Number(row.value);
    return row.value;
  }

  /**
   * Save a single setting
   */
  saveSetting(key: string, value: any): void {
    const db = this.getDatabase();
    const stringValue = String(value);
    
    db.prepare(`
      INSERT INTO tts_settings (key, value) 
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, stringValue);

    // Notify frontend if TTS enabled state changed
    if ((key === 'tts_enabled') && TTSRepository.mainWindow && !TTSRepository.mainWindow.isDestroyed()) {
      console.log(`[TTSRepository] TTS tts_enabled changed: ${value}, sending IPC notification to frontend`);
      TTSRepository.mainWindow.webContents.send('tts:settings-changed', {
        enabled: value === true || value === 'true',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Save multiple settings at once
   */
  saveSettings(settings: Record<string, any>): void {
    const db = this.getDatabase();
    const stmt = db.prepare(`
      INSERT INTO tts_settings (key, value) 
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    const transaction = db.transaction((settingsObj: Record<string, any>) => {
      for (const [key, value] of Object.entries(settingsObj)) {
        stmt.run(key, String(value));
      }
    });

    transaction(settings);

    // Notify frontend if TTS enabled state changed (check the actual database field name: tts_enabled)
    if (settings.tts_enabled !== undefined && TTSRepository.mainWindow && !TTSRepository.mainWindow.isDestroyed()) {
      console.log(`[TTSRepository] TTS tts_enabled changed via saveSettings: ${settings.tts_enabled}, sending IPC notification`);
      TTSRepository.mainWindow.webContents.send('tts:settings-changed', {
        enabled: settings.tts_enabled === true || settings.tts_enabled === 'true',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get viewer's TTS settings
   */
  getViewerTTSSettings(viewerId: string): { ttsVoiceId: string | null, ttsEnabled: boolean } {
    const db = this.getDatabase();
    const row = db.prepare(`
      SELECT tts_voice_id, tts_enabled 
      FROM viewers 
      WHERE id = ?
    `).get(viewerId) as { tts_voice_id: string | null, tts_enabled: number } | undefined;

    if (!row) {
      return { ttsVoiceId: null, ttsEnabled: true };
    }

    return {
      ttsVoiceId: row.tts_voice_id,
      ttsEnabled: row.tts_enabled === 1
    };
  }

  /**
   * Update viewer's TTS settings
   */
  updateViewerTTSSettings(viewerId: string, ttsVoiceId: string | null, ttsEnabled: boolean): void {
    const db = this.getDatabase();
    db.prepare(`
      UPDATE viewers 
      SET tts_voice_id = ?, tts_enabled = ?
      WHERE id = ?
    `).run(ttsVoiceId, ttsEnabled ? 1 : 0, viewerId);
  }
}
