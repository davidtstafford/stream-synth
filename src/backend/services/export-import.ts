import { getDatabase } from '../database/connection';
import * as fs from 'fs';
import * as path from 'path';
import { app, dialog } from 'electron';

export interface ExportData {
  version: string;
  exported_at: string;
  app_info: {
    name: string;
    version: string;
  };
  settings: Array<{ key: string; value: string }>;
  tts_settings: Array<{ key: string; value: string }>;
  viewers: Array<{
    id: string;
    username: string;
    display_name?: string;
    tts_voice_id?: string;
    tts_enabled: boolean;
  }>;
  event_profiles: Array<{
    user_id: string;
    user_login?: string;
    channel_id: string;
    channel_login?: string;
    events: Array<{
      event_type: string;
      is_enabled: boolean;
    }>;
  }>;
  connection_history: Array<{
    user_login: string;
    channel_login: string;
    is_broadcaster: boolean;
    connected_at: string;
  }>;
}

export async function exportSettings(): Promise<string> {
  const db = getDatabase();

  // Get all settings (excluding sensitive data and tokens)
  const settings = db.prepare('SELECT key, value FROM app_settings WHERE key NOT LIKE \'%token%\' AND key NOT LIKE \'%api_key%\'').all() as Array<{ key: string; value: string }>;

  // Get all TTS settings (excluding API keys)
  const ttsSettings = db.prepare('SELECT key, value FROM tts_settings WHERE key NOT LIKE \'%api_key%\'').all() as Array<{ key: string; value: string }>;

  // Get all viewer settings (TTS voice preferences)
  const viewers = db.prepare('SELECT id, username, display_name, tts_voice_id, tts_enabled FROM viewers').all() as Array<any>;

  // Get all event subscriptions grouped by user/channel
  const eventSubs = db.prepare(`
    SELECT 
      es.*,
      cs.user_login,
      cs.channel_login
    FROM event_subscriptions es
    LEFT JOIN connection_sessions cs 
      ON es.user_id = cs.user_id 
      AND es.channel_id = cs.channel_id
    ORDER BY es.user_id, es.channel_id, es.event_type
  `).all() as Array<any>;

  // Group events by user/channel
  const eventProfiles: Map<string, any> = new Map();
  eventSubs.forEach(sub => {
    const key = `${sub.user_id}:${sub.channel_id}`;
    if (!eventProfiles.has(key)) {
      eventProfiles.set(key, {
        user_id: sub.user_id,
        user_login: sub.user_login,
        channel_id: sub.channel_id,
        channel_login: sub.channel_login,
        events: []
      });
    }
    eventProfiles.get(key).events.push({
      event_type: sub.event_type,
      is_enabled: sub.is_enabled === 1
    });
  });

  // Get connection history (last 20 sessions)
  const sessions = db.prepare(`
    SELECT user_login, channel_login, is_broadcaster, connected_at
    FROM connection_sessions
    ORDER BY connected_at DESC
    LIMIT 20
  `).all() as Array<any>;

  const exportData: ExportData = {
    version: '1.0.0',
    exported_at: new Date().toISOString(),
    app_info: {
      name: 'Stream Synth',
      version: app.getVersion()
    },
    settings: settings.filter(s => !s.key.includes('password') && !s.key.includes('secret')),
    tts_settings: ttsSettings,
    viewers: viewers.map(v => ({
      id: v.id,
      username: v.username,
      display_name: v.display_name,
      tts_voice_id: v.tts_voice_id,
      tts_enabled: v.tts_enabled === 1
    })),
    event_profiles: Array.from(eventProfiles.values()),
    connection_history: sessions.map(s => ({
      user_login: s.user_login,
      channel_login: s.channel_login,
      is_broadcaster: s.is_broadcaster === 1,
      connected_at: s.connected_at
    }))
  };

  // Show save dialog
  const result = await dialog.showSaveDialog({
    title: 'Export Stream Synth Settings',
    defaultPath: path.join(app.getPath('documents'), `stream-synth-backup-${Date.now()}.json`),
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || !result.filePath) {
    throw new Error('Export canceled');
  }

  // Write to file
  fs.writeFileSync(result.filePath, JSON.stringify(exportData, null, 2), 'utf-8');

  return result.filePath;
}

export async function importSettings(): Promise<{ success: boolean; message: string; imported: any }> {
  // Show open dialog
  const result = await dialog.showOpenDialog({
    title: 'Import Stream Synth Settings',
    defaultPath: app.getPath('documents'),
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) {
    throw new Error('Import canceled');
  }

  const filePath = result.filePaths[0];

  // Read and parse file
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  let importData: ExportData;

  try {
    importData = JSON.parse(fileContent);
  } catch (error) {
    throw new Error('Invalid JSON file');
  }

  // Validate structure
  if (!importData.version || !importData.settings || !importData.event_profiles) {
    throw new Error('Invalid backup file format');
  }

  const db = getDatabase();

  // Start transaction
  db.exec('BEGIN TRANSACTION');

  try {
    let importedCount = 0;

    // Import settings (skip certain keys)
    const skipKeys = ['last_connected_user_id', 'last_connected_channel_id']; // Don't auto-login after import
    const settingsStmt = db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `);

    importData.settings.forEach(setting => {
      if (!skipKeys.includes(setting.key)) {
        settingsStmt.run(setting.key, setting.value);
        importedCount++;
      }
    });

    // Import TTS settings
    if (importData.tts_settings) {
      const ttsStmt = db.prepare(`
        INSERT INTO tts_settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = CURRENT_TIMESTAMP
      `);

      importData.tts_settings.forEach(setting => {
        ttsStmt.run(setting.key, setting.value);
        importedCount++;
      });
    }

    // Import viewer TTS preferences
    if (importData.viewers) {
      const viewerStmt = db.prepare(`
        INSERT INTO viewers (id, username, display_name, tts_voice_id, tts_enabled)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          display_name = excluded.display_name,
          tts_voice_id = excluded.tts_voice_id,
          tts_enabled = excluded.tts_enabled,
          updated_at = CURRENT_TIMESTAMP
      `);

      importData.viewers.forEach(viewer => {
        viewerStmt.run(
          viewer.id,
          viewer.username,
          viewer.display_name || null,
          viewer.tts_voice_id || null,
          viewer.tts_enabled ? 1 : 0
        );
        importedCount++;
      });
    }

    // Import event profiles
    const eventStmt = db.prepare(`
      INSERT INTO event_subscriptions (user_id, channel_id, event_type, is_enabled, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, channel_id, event_type) DO UPDATE SET
        is_enabled = excluded.is_enabled,
        updated_at = CURRENT_TIMESTAMP
    `);

    importData.event_profiles.forEach(profile => {
      profile.events.forEach(event => {
        eventStmt.run(
          profile.user_id,
          profile.channel_id,
          event.event_type,
          event.is_enabled ? 1 : 0
        );
        importedCount++;
      });
    });

    db.exec('COMMIT');

    return {
      success: true,
      message: `Successfully imported ${importedCount} items`,
      imported: {
        settings: importData.settings.length,
        tts_settings: importData.tts_settings?.length || 0,
        viewers: importData.viewers?.length || 0,
        event_profiles: importData.event_profiles.length,
        events: importData.event_profiles.reduce((sum, p) => sum + p.events.length, 0)
      }
    };

  } catch (error: any) {
    db.exec('ROLLBACK');
    throw new Error(`Import failed: ${error.message}`);
  }
}

export function getExportPreview(): ExportData {
  const db = getDatabase();

  const settings = db.prepare('SELECT key, value FROM app_settings WHERE key NOT LIKE \'%token%\' AND key NOT LIKE \'%api_key%\'').all() as Array<{ key: string; value: string }>;

  const ttsSettings = db.prepare('SELECT key, value FROM tts_settings WHERE key NOT LIKE \'%api_key%\'').all() as Array<{ key: string; value: string }>;

  const viewers = db.prepare('SELECT id, username, display_name, tts_voice_id, tts_enabled FROM viewers').all() as Array<any>;

  const eventSubs = db.prepare(`
    SELECT 
      es.*,
      cs.user_login,
      cs.channel_login
    FROM event_subscriptions es
    LEFT JOIN connection_sessions cs 
      ON es.user_id = cs.user_id 
      AND es.channel_id = cs.channel_id
  `).all() as Array<any>;

  const eventProfiles: Map<string, any> = new Map();
  eventSubs.forEach(sub => {
    const key = `${sub.user_id}:${sub.channel_id}`;
    if (!eventProfiles.has(key)) {
      eventProfiles.set(key, {
        user_id: sub.user_id,
        user_login: sub.user_login,
        channel_id: sub.channel_id,
        channel_login: sub.channel_login,
        events: []
      });
    }
    eventProfiles.get(key).events.push({
      event_type: sub.event_type,
      is_enabled: sub.is_enabled === 1
    });
  });

  const sessions = db.prepare(`
    SELECT user_login, channel_login, is_broadcaster, connected_at
    FROM connection_sessions
    ORDER BY connected_at DESC
    LIMIT 20
  `).all() as Array<any>;

  return {
    version: '1.0.0',
    exported_at: new Date().toISOString(),
    app_info: {
      name: 'Stream Synth',
      version: app.getVersion()
    },
    settings: settings,
    tts_settings: ttsSettings,
    viewers: viewers.map(v => ({
      id: v.id,
      username: v.username,
      display_name: v.display_name,
      tts_voice_id: v.tts_voice_id,
      tts_enabled: v.tts_enabled === 1
    })),
    event_profiles: Array.from(eventProfiles.values()),
    connection_history: sessions.map(s => ({
      user_login: s.user_login,
      channel_login: s.channel_login,
      is_broadcaster: s.is_broadcaster === 1,
      connected_at: s.connected_at
    }))
  };
}
