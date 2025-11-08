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
  tts_access_config?: any; // TTS access configuration
  polling_configs?: Array<any>; // Twitch API polling configurations
  viewers: Array<{
    id: string;
    username: string;
    display_name?: string;
    tts_voice_id?: string;
    tts_enabled: boolean;
  }>;
  viewer_voice_preferences?: Array<any>; // Individual viewer voice preferences
  viewer_rules?: Array<any>; // Viewer restrictions/rules
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
  event_actions?: Array<any>; // Event actions (browser source alerts, etc.)
  chat_commands_config?: Array<any>; // Chat command configurations
  entrance_sounds?: Array<any>; // Viewer entrance sounds
  vip_list?: Array<any>; // VIP users
  subscriber_list?: Array<any>; // Subscriber users
  moderator_list?: Array<any>; // Moderator users
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

  // Get TTS access config
  const ttsAccessConfig = db.prepare(`
    SELECT * FROM tts_access_config WHERE id = 1
  `).get() as any;

  // Get polling configs (user-customizable settings only)
  const pollingConfigs = db.prepare(`
    SELECT api_type, interval_value, enabled
    FROM twitch_polling_config
  `).all() as Array<any>;

  // Get viewer voice preferences
  const voicePreferences = db.prepare(`
    SELECT viewer_id, voice_id, provider, pitch, speed
    FROM viewer_voice_preferences
  `).all() as Array<any>;

  // Get viewer rules/restrictions
  const viewerRules = db.prepare(`
    SELECT * FROM viewer_rules
  `).all() as Array<any>;

  // Get event actions (browser source alerts, etc.)
  const eventActions = db.prepare(`
    SELECT * FROM event_actions
  `).all() as Array<any>;

  // Get chat commands configuration
  const chatCommandsConfig = db.prepare(`
    SELECT * FROM chat_commands_config
  `).all() as Array<any>;

  // Get entrance sounds
  const entranceSounds = db.prepare(`
    SELECT * FROM viewer_entrance_sounds
  `).all() as Array<any>;

  // Get VIP list
  const vipList = db.prepare(`
    SELECT viewer_id, vip_username, channel_id, added_at
    FROM vips
  `).all() as Array<any>;

  // Get subscriber list
  const subscriberList = db.prepare(`
    SELECT viewer_id, subscriber_username, channel_id, tier, added_at
    FROM subscribers
  `).all() as Array<any>;

  // Get moderator list
  const moderatorList = db.prepare(`
    SELECT viewer_id, moderator_username, channel_id, added_at
    FROM moderators
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
    tts_access_config: ttsAccessConfig,
    polling_configs: pollingConfigs,
    viewers: viewers.map(v => ({
      id: v.id,
      username: v.username,
      display_name: v.display_name,
      tts_voice_id: v.tts_voice_id,
      tts_enabled: v.tts_enabled === 1
    })),
    viewer_voice_preferences: voicePreferences,
    viewer_rules: viewerRules,
    event_profiles: Array.from(eventProfiles.values()),
    event_actions: eventActions,
    chat_commands_config: chatCommandsConfig,
    entrance_sounds: entranceSounds,
    vip_list: vipList,
    subscriber_list: subscriberList,
    moderator_list: moderatorList,
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
    }    // Import viewer TTS preferences
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

    // Import viewer voice preferences
    if (importData.viewer_voice_preferences) {
      const voicePrefStmt = db.prepare(`
        INSERT INTO viewer_voice_preferences (viewer_id, voice_id, provider, pitch, speed)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(viewer_id) DO UPDATE SET
          voice_id = excluded.voice_id,
          provider = excluded.provider,
          pitch = excluded.pitch,
          speed = excluded.speed,
          updated_at = CURRENT_TIMESTAMP
      `);

      importData.viewer_voice_preferences.forEach(pref => {
        voicePrefStmt.run(
          pref.viewer_id,
          pref.voice_id,
          pref.provider,
          pref.pitch,
          pref.speed
        );
        importedCount++;
      });
    }

    // Import TTS access config
    if (importData.tts_access_config) {
      const config = importData.tts_access_config;
      const ttsAccessStmt = db.prepare(`
        UPDATE tts_access_config SET
          access_mode = ?,
          limited_allow_subscribers = ?,
          limited_deny_gifted_subs = ?,
          limited_allow_vip = ?,
          limited_allow_mod = ?,
          limited_redeem_name = ?,
          limited_redeem_duration_mins = ?,
          premium_allow_subscribers = ?,
          premium_deny_gifted_subs = ?,
          premium_allow_vip = ?,
          premium_allow_mod = ?,
          premium_redeem_name = ?,
          premium_redeem_duration_mins = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `);

      ttsAccessStmt.run(
        config.access_mode,
        config.limited_allow_subscribers,
        config.limited_deny_gifted_subs,
        config.limited_allow_vip,
        config.limited_allow_mod || 0,
        config.limited_redeem_name,
        config.limited_redeem_duration_mins,
        config.premium_allow_subscribers,
        config.premium_deny_gifted_subs,
        config.premium_allow_vip,
        config.premium_allow_mod || 0,
        config.premium_redeem_name,
        config.premium_redeem_duration_mins
      );
      importedCount++;
    }

    // Import polling configs (only user-customizable settings)
    if (importData.polling_configs) {
      const pollingStmt = db.prepare(`
        UPDATE twitch_polling_config SET
          interval_value = ?,
          enabled = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE api_type = ?
      `);

      importData.polling_configs.forEach(config => {
        pollingStmt.run(
          config.interval_value,
          config.enabled,
          config.api_type
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

    // Import viewer rules
    if (importData.viewer_rules && importData.viewer_rules.length > 0) {
      const viewerRulesStmt = db.prepare(`
        INSERT INTO viewer_rules (viewer_id, rule_type, enabled, created_at, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(viewer_id, rule_type) DO UPDATE SET
          enabled = excluded.enabled,
          updated_at = CURRENT_TIMESTAMP
      `);

      importData.viewer_rules.forEach((rule: any) => {
        viewerRulesStmt.run(rule.viewer_id, rule.rule_type, rule.enabled ? 1 : 0);
        importedCount++;
      });
    }

    // Import event actions
    if (importData.event_actions && importData.event_actions.length > 0) {
      const eventActionStmt = db.prepare(`
        INSERT INTO event_actions (channel_id, event_type, is_enabled, action_type, alert_sound_enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(channel_id, event_type) DO UPDATE SET
          is_enabled = excluded.is_enabled,
          action_type = excluded.action_type,
          updated_at = CURRENT_TIMESTAMP
      `);

      importData.event_actions.forEach((action: any) => {
        eventActionStmt.run(
          action.channel_id,
          action.event_type,
          action.is_enabled ? 1 : 0,
          action.action_type,
          action.alert_sound_enabled ? 1 : 0
        );
        importedCount++;
      });
    }

    // Import chat commands config
    if (importData.chat_commands_config && importData.chat_commands_config.length > 0) {
      const chatCmdStmt = db.prepare(`
        INSERT INTO chat_commands_config (command_name, command_prefix, enabled, permission_level, rate_limit_seconds)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(command_name) DO UPDATE SET
          enabled = excluded.enabled,
          permission_level = excluded.permission_level,
          rate_limit_seconds = excluded.rate_limit_seconds
      `);

      importData.chat_commands_config.forEach((cmd: any) => {
        chatCmdStmt.run(
          cmd.command_name,
          cmd.command_prefix,
          cmd.enabled ? 1 : 0,
          cmd.permission_level,
          cmd.rate_limit_seconds
        );
        importedCount++;
      });
    }

    // Import entrance sounds
    if (importData.entrance_sounds && importData.entrance_sounds.length > 0) {
      const soundStmt = db.prepare(`
        INSERT INTO viewer_entrance_sounds (viewer_id, sound_file_path, volume)
        VALUES (?, ?, ?)
        ON CONFLICT(viewer_id) DO UPDATE SET
          sound_file_path = excluded.sound_file_path,
          volume = excluded.volume
      `);

      importData.entrance_sounds.forEach((sound: any) => {
        soundStmt.run(sound.viewer_id, sound.sound_file_path, sound.volume);
        importedCount++;
      });
    }

    // Import VIP list
    if (importData.vip_list && importData.vip_list.length > 0) {
      const vipStmt = db.prepare(`
        INSERT INTO vips (viewer_id, vip_username, channel_id, added_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(viewer_id, channel_id) DO UPDATE SET
          added_at = excluded.added_at
      `);

      importData.vip_list.forEach((vip: any) => {
        vipStmt.run(vip.viewer_id, vip.vip_username, vip.channel_id, vip.added_at);
        importedCount++;
      });
    }

    // Import subscriber list
    if (importData.subscriber_list && importData.subscriber_list.length > 0) {
      const subStmt = db.prepare(`
        INSERT INTO subscribers (viewer_id, subscriber_username, channel_id, tier, added_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(viewer_id, channel_id) DO UPDATE SET
          tier = excluded.tier,
          added_at = excluded.added_at
      `);

      importData.subscriber_list.forEach((sub: any) => {
        subStmt.run(sub.viewer_id, sub.subscriber_username, sub.channel_id, sub.tier, sub.added_at);
        importedCount++;
      });
    }

    // Import moderator list
    if (importData.moderator_list && importData.moderator_list.length > 0) {
      const modStmt = db.prepare(`
        INSERT INTO moderators (viewer_id, moderator_username, channel_id, added_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(viewer_id, channel_id) DO UPDATE SET
          added_at = excluded.added_at
      `);

      importData.moderator_list.forEach((mod: any) => {
        modStmt.run(mod.viewer_id, mod.moderator_username, mod.channel_id, mod.added_at);
        importedCount++;
      });
    }

    db.exec('COMMIT');    return {
      success: true,
      message: `Successfully imported ${importedCount} items`,
      imported: {
        settings: importData.settings.length,
        tts_settings: importData.tts_settings?.length || 0,
        tts_access_config: importData.tts_access_config ? 1 : 0,
        polling_configs: importData.polling_configs?.length || 0,
        viewers: importData.viewers?.length || 0,
        viewer_voice_preferences: importData.viewer_voice_preferences?.length || 0,
        viewer_rules: importData.viewer_rules?.length || 0,
        event_profiles: importData.event_profiles.length,
        event_actions: importData.event_actions?.length || 0,
        chat_commands_config: importData.chat_commands_config?.length || 0,
        entrance_sounds: importData.entrance_sounds?.length || 0,
        vip_list: importData.vip_list?.length || 0,
        subscriber_list: importData.subscriber_list?.length || 0,
        moderator_list: importData.moderator_list?.length || 0,
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

  const ttsAccessConfig = db.prepare('SELECT * FROM tts_access_config WHERE id = 1').get() as any;

  const pollingConfigs = db.prepare('SELECT api_type, interval_value, enabled FROM twitch_polling_config').all() as Array<any>;

  const voicePreferences = db.prepare('SELECT viewer_id, voice_id, provider, pitch, speed FROM viewer_voice_preferences').all() as Array<any>;

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
    tts_access_config: ttsAccessConfig,
    polling_configs: pollingConfigs,
    viewers: viewers.map(v => ({
      id: v.id,
      username: v.username,
      display_name: v.display_name,
      tts_voice_id: v.tts_voice_id,
      tts_enabled: v.tts_enabled === 1
    })),
    viewer_voice_preferences: voicePreferences,
    event_profiles: Array.from(eventProfiles.values()),
    connection_history: sessions.map(s => ({
      user_login: s.user_login,
      channel_login: s.channel_login,
      is_broadcaster: s.is_broadcaster === 1,
      connected_at: s.connected_at
    }))
  };
}
