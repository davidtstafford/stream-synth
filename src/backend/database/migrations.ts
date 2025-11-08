import Database from 'better-sqlite3';

/**
 * Database Migrations
 * 
 * Clean schema initialization without patches or compatibility code
 * Run this on fresh database or after deleting old database
 */
export function runMigrations(db: Database.Database): void {
  console.log('[Migrations] Starting clean database schema initialization...');

  // ===== CORE AUTHENTICATION & SESSIONS =====

  db.exec(`
    CREATE TABLE IF NOT EXISTS oauth_tokens (
      user_id TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      client_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      is_valid BOOLEAN DEFAULT 1
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS connection_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      user_login TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      channel_login TEXT NOT NULL,
      is_broadcaster BOOLEAN NOT NULL,
      connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      disconnected_at DATETIME,
      is_current BOOLEAN DEFAULT 0
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS event_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      is_enabled BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, channel_id, event_type)
    )
  `);

  // ===== APPLICATION SETTINGS =====

  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tts_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    INSERT OR IGNORE INTO tts_settings (key, value) VALUES
      ('tts_enabled', 'false'),
      ('tts_provider', 'webspeech'),
      ('tts_voice_id', ''),
      ('tts_volume', '80'),
      ('tts_rate', '1.0'),
      ('tts_pitch', '1.0'),
      ('azure_api_key', ''),
      ('azure_region', 'eastus'),
      ('google_api_key', ''),
      ('filter_commands', 'true'),
      ('filter_bots', 'true'),
      ('filter_urls', 'true'),
      ('announce_username', 'true'),
      ('min_message_length', '0'),
      ('max_message_length', '500'),
      ('skip_duplicate_messages', 'true'),
      ('duplicate_message_window', '30'),
      ('user_cooldown_enabled', 'false'),
      ('user_cooldown_seconds', '30'),
      ('global_cooldown_enabled', 'false'),
      ('global_cooldown_seconds', '5'),
      ('max_queue_size', '20'),      ('max_emotes_per_message', '5'),
      ('max_emojis_per_message', '3'),
      ('strip_excessive_emotes', 'true'),
      ('max_repeated_chars', '3'),
      ('max_repeated_words', '2'),
      ('copypasta_filter_enabled', 'false'),
      ('blocked_words', '[]'),
      ('browser_source_enabled', 'false'),
      ('browser_source_mute_app', 'false')
  `);

  // ===== VIEWERS & SUBSCRIPTIONS =====

  db.exec(`
    CREATE TABLE IF NOT EXISTS viewers (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      display_name TEXT,
      tts_voice_id TEXT,
      tts_enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_viewers_username ON viewers(username)
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS viewer_subscriptions (
      id TEXT PRIMARY KEY,
      viewer_id TEXT NOT NULL,
      tier TEXT NOT NULL,
      is_gift INTEGER DEFAULT 0,
      start_date DATETIME NOT NULL,
      end_date DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (viewer_id) REFERENCES viewers(id)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_subscriptions_viewer ON viewer_subscriptions(viewer_id)
  `);

  // ===== VIEWER ROLES =====

  db.exec(`
    CREATE TABLE IF NOT EXISTS viewer_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      viewer_id TEXT NOT NULL,
      role_type TEXT NOT NULL,
      granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      revoked_at DATETIME,
      FOREIGN KEY (viewer_id) REFERENCES viewers(id) ON DELETE CASCADE,
      CHECK (role_type IN ('vip', 'moderator', 'broadcaster')),
      UNIQUE(viewer_id, role_type)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_viewer_roles ON viewer_roles(viewer_id, role_type)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_active_roles ON viewer_roles(viewer_id, role_type, revoked_at)
  `);

  // ===== VIEWER TTS RULES & PREFERENCES =====

  db.exec(`
    CREATE TABLE IF NOT EXISTS viewer_tts_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      viewer_id TEXT UNIQUE NOT NULL,
      is_muted INTEGER DEFAULT 0,
      mute_period_mins INTEGER,
      muted_at TEXT,
      mute_expires_at TEXT,
      has_cooldown INTEGER DEFAULT 0,
      cooldown_gap_seconds INTEGER,
      cooldown_period_mins INTEGER,
      cooldown_set_at TEXT,
      cooldown_expires_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (viewer_id) REFERENCES viewers(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_viewer_tts_rules_viewer ON viewer_tts_rules(viewer_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_viewer_tts_rules_muted ON viewer_tts_rules(is_muted)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_viewer_tts_rules_cooldown ON viewer_tts_rules(has_cooldown)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_viewer_tts_rules_mute_expires ON viewer_tts_rules(mute_expires_at)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_viewer_tts_rules_cooldown_expires ON viewer_tts_rules(cooldown_expires_at)
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS viewer_voice_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      viewer_id TEXT NOT NULL UNIQUE,
      voice_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      pitch REAL DEFAULT 1.0,
      speed REAL DEFAULT 1.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (viewer_id) REFERENCES viewers(id) ON DELETE CASCADE,
      CHECK (provider IN ('webspeech', 'azure', 'google')),
      CHECK (pitch >= 0.5 AND pitch <= 2.0),
      CHECK (speed >= 0.5 AND speed <= 2.0)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_viewer_voice_prefs ON viewer_voice_preferences(viewer_id)
  `);

  // ===== VIEWER ENTRANCE SOUNDS =====

  db.exec(`
    CREATE TABLE IF NOT EXISTS viewer_entrance_sounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      viewer_id TEXT NOT NULL UNIQUE,
      viewer_username TEXT NOT NULL,
      sound_file_path TEXT NOT NULL,
      volume INTEGER DEFAULT 100,
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_viewer_entrance_sounds_viewer_id 
      ON viewer_entrance_sounds(viewer_id)
  `);
  
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_viewer_entrance_sounds_enabled 
      ON viewer_entrance_sounds(enabled)
  `);

  // ===== TTS VOICES (PROVIDERS) =====

  db.exec(`
    CREATE TABLE IF NOT EXISTS webspeech_voices (
      numeric_id INTEGER PRIMARY KEY AUTOINCREMENT,
      voice_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      language_name TEXT NOT NULL,
      region TEXT,
      gender TEXT,
      provider TEXT DEFAULT 'webspeech',
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_webspeech_voices_numeric_id ON webspeech_voices(numeric_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_webspeech_voices_language ON webspeech_voices(language_name)
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS azure_voices (
      numeric_id INTEGER PRIMARY KEY AUTOINCREMENT,
      voice_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      language_name TEXT NOT NULL,
      region TEXT,
      gender TEXT,
      provider TEXT DEFAULT 'azure',
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_azure_voices_numeric_id ON azure_voices(numeric_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_azure_voices_language ON azure_voices(language_name)
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS google_voices (
      numeric_id INTEGER PRIMARY KEY AUTOINCREMENT,
      voice_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      language_name TEXT NOT NULL,
      region TEXT,
      gender TEXT,
      provider TEXT DEFAULT 'google',
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_google_voices_numeric_id ON google_voices(numeric_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_google_voices_language ON google_voices(language_name)
  `);

  db.exec(`
    CREATE VIEW IF NOT EXISTS all_voices AS
    SELECT * FROM webspeech_voices
    UNION ALL
    SELECT * FROM azure_voices
    UNION ALL
    SELECT * FROM google_voices
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tts_provider_status (
      provider TEXT PRIMARY KEY,
      is_enabled INTEGER DEFAULT 1,
      last_synced_at TEXT,
      voice_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ===== TTS ACCESS CONTROL =====

  db.exec(`
    CREATE TABLE IF NOT EXISTS tts_access_config (
      id INTEGER PRIMARY KEY DEFAULT 1,
      access_mode TEXT NOT NULL DEFAULT 'access_all',
      limited_allow_subscribers INTEGER DEFAULT 1,
      limited_deny_gifted_subs INTEGER DEFAULT 0,
      limited_allow_vip INTEGER DEFAULT 0,
      limited_allow_mod INTEGER DEFAULT 0,
      limited_redeem_name TEXT,
      limited_redeem_duration_mins INTEGER,
      premium_allow_subscribers INTEGER DEFAULT 1,
      premium_deny_gifted_subs INTEGER DEFAULT 0,
      premium_allow_vip INTEGER DEFAULT 0,
      premium_allow_mod INTEGER DEFAULT 0,
      premium_redeem_name TEXT,
      premium_redeem_duration_mins INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CHECK (id = 1),
      CHECK (access_mode IN ('access_all', 'limited_access', 'premium_voice_access'))
    )
  `);

  db.exec(`
    INSERT OR IGNORE INTO tts_access_config (id, access_mode) VALUES (1, 'access_all')
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS channel_point_grants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      viewer_id TEXT NOT NULL,
      grant_type TEXT NOT NULL,
      redeem_name TEXT NOT NULL,
      duration_mins INTEGER NOT NULL,
      granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      FOREIGN KEY (viewer_id) REFERENCES viewers(id) ON DELETE CASCADE,
      CHECK (grant_type IN ('limited_access', 'premium_voice_access'))
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_grants_viewer ON channel_point_grants(viewer_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_grants_expiry ON channel_point_grants(expires_at)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_grants_active ON channel_point_grants(viewer_id, expires_at)
  `);

  // ===== EVENTS & HISTORY =====

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      event_data TEXT NOT NULL,
      viewer_id TEXT,
      channel_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (viewer_id) REFERENCES viewers(id)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_events_channel ON events(channel_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_events_viewer ON events(viewer_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at)
  `);

  // ===== FOLLOWER HISTORY =====

  db.exec(`
    CREATE TABLE IF NOT EXISTS follower_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      viewer_id TEXT NOT NULL,
      follower_user_id TEXT NOT NULL,
      follower_user_login TEXT NOT NULL,
      follower_user_name TEXT,
      action TEXT NOT NULL,
      followed_at TEXT,
      detected_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (viewer_id) REFERENCES viewers(id) ON DELETE CASCADE,
      CHECK (action IN ('follow', 'unfollow'))
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_follower_history_channel ON follower_history(channel_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_follower_history_viewer ON follower_history(viewer_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_follower_history_user_id ON follower_history(follower_user_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_follower_history_action ON follower_history(action)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_follower_history_detected ON follower_history(detected_at)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_follower_history_followed ON follower_history(followed_at)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_follower_current_state ON follower_history(channel_id, follower_user_id, detected_at DESC)
  `);

  db.exec(`
    CREATE VIEW IF NOT EXISTS current_followers AS
    SELECT 
      fh.channel_id,
      fh.viewer_id,
      fh.follower_user_id,
      fh.follower_user_login,
      fh.follower_user_name,
      fh.followed_at,
      fh.detected_at,
      v.display_name,
      v.tts_voice_id,
      v.tts_enabled
    FROM (
      SELECT 
        channel_id,
        viewer_id,
        follower_user_id,
        follower_user_login,
        follower_user_name,
        followed_at,
        detected_at,
        action,
        ROW_NUMBER() OVER (
          PARTITION BY channel_id, follower_user_id 
          ORDER BY detected_at DESC
        ) as rn
      FROM follower_history
    ) fh
    INNER JOIN viewers v ON fh.viewer_id = v.id
    WHERE fh.rn = 1 AND fh.action = 'follow'
    ORDER BY fh.followed_at DESC
  `);

  // ===== MODERATION HISTORY =====

  db.exec(`
    CREATE TABLE IF NOT EXISTS moderation_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      viewer_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_login TEXT NOT NULL,
      user_name TEXT,
      action TEXT NOT NULL,
      reason TEXT,
      duration_seconds INTEGER,
      moderator_id TEXT,
      moderator_login TEXT,
      action_at TEXT NOT NULL,
      detected_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (viewer_id) REFERENCES viewers(id) ON DELETE CASCADE,
      CHECK (action IN ('ban', 'timeout', 'unban', 'timeout_lifted'))
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_moderation_history_channel ON moderation_history(channel_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_moderation_history_viewer ON moderation_history(viewer_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_moderation_history_user_id ON moderation_history(user_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_moderation_history_action ON moderation_history(action)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_moderation_history_detected ON moderation_history(detected_at)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_moderation_current_state ON moderation_history(channel_id, user_id, detected_at DESC)
  `);

  db.exec(`
    CREATE VIEW IF NOT EXISTS current_moderation_status AS
    SELECT 
      mh.channel_id,
      mh.viewer_id,
      mh.user_id,
      mh.user_login,
      mh.user_name,
      mh.action,
      mh.reason,
      mh.duration_seconds,
      mh.moderator_id,
      mh.moderator_login,
      mh.action_at,
      mh.detected_at,
      v.display_name,
      v.tts_voice_id,
      v.tts_enabled,
      CASE 
        WHEN mh.action = 'ban' THEN 'banned'
        WHEN mh.action = 'unban' THEN 'active'
        WHEN mh.action = 'timeout' THEN 'timed_out'
        WHEN mh.action = 'timeout_lifted' THEN 'active'
        ELSE 'unknown'
      END AS current_status,
      CASE 
        WHEN mh.action = 'timeout' THEN 
          datetime(mh.action_at, '+' || mh.duration_seconds || ' seconds')
        ELSE NULL
      END AS timeout_expires_at
    FROM (
      SELECT 
        channel_id,
        viewer_id,
        user_id,
        user_login,
        user_name,
        action,
        reason,
        duration_seconds,
        moderator_id,
        moderator_login,
        action_at,
        detected_at,
        ROW_NUMBER() OVER (
          PARTITION BY channel_id, user_id 
          ORDER BY detected_at DESC
        ) as rn
      FROM moderation_history
    ) mh
    INNER JOIN viewers v ON mh.viewer_id = v.id
    WHERE mh.rn = 1
    ORDER BY mh.detected_at DESC
  `);  // ===== VIEWER SUBSCRIPTION STATUS VIEW =====

  db.exec(`
    DROP VIEW IF EXISTS viewer_subscription_status
  `);

  db.exec(`
    CREATE VIEW viewer_subscription_status AS
    SELECT 
      v.id,
      v.display_name,
      v.tts_voice_id,
      v.tts_enabled,
      v.created_at,
      v.updated_at,
      vs.tier,
      vs.is_gift,
      vs.start_date,
      vs.end_date,
      CASE 
        WHEN vs.id IS NOT NULL THEN 
          CASE 
            WHEN vs.is_gift = 1 THEN vs.tier || ' (Gift)'
            ELSE vs.tier || ' Subscriber'
          END
        ELSE 'Not Subscribed'
      END AS subscription_status,
      (SELECT 1 FROM viewer_roles WHERE viewer_id = v.id AND role_type = 'vip' AND revoked_at IS NULL) AS is_vip,
      (SELECT 1 FROM viewer_roles WHERE viewer_id = v.id AND role_type = 'moderator' AND revoked_at IS NULL) AS is_moderator,
      (SELECT 1 FROM viewer_roles WHERE viewer_id = v.id AND role_type = 'broadcaster' AND revoked_at IS NULL) AS is_broadcaster,
      cms.current_status AS moderation_status,
      cms.reason AS moderation_reason,
      cms.timeout_expires_at AS moderation_expires_at,
      cf.followed_at AS followed_at,
      CASE WHEN cf.follower_user_id IS NOT NULL THEN 1 ELSE 0 END AS is_follower
    FROM viewers v
    LEFT JOIN viewer_subscriptions vs ON v.id = vs.viewer_id
    LEFT JOIN current_moderation_status cms ON v.id = cms.viewer_id
    LEFT JOIN current_followers cf ON v.id = cf.viewer_id
  `);

  // ===== TWITCH API POLLING CONFIGURATION =====

  db.exec(`
    CREATE TABLE IF NOT EXISTS twitch_polling_config (
      api_type TEXT PRIMARY KEY,
      interval_value INTEGER NOT NULL DEFAULT 30,
      min_interval INTEGER NOT NULL DEFAULT 5,
      max_interval INTEGER NOT NULL DEFAULT 120,
      interval_units TEXT NOT NULL DEFAULT 'minutes',
      step INTEGER NOT NULL DEFAULT 5,
      enabled INTEGER DEFAULT 1,
      last_poll_at DATETIME,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CHECK (interval_value >= min_interval AND interval_value <= max_interval),
      CHECK (interval_units IN ('seconds', 'minutes', 'hours')),
      CHECK (api_type IN ('role_sync', 'followers', 'moderation'))
    )
  `);
  db.exec(`
    INSERT OR IGNORE INTO twitch_polling_config (
      api_type, interval_value, min_interval, max_interval, interval_units, step, description
    ) VALUES 
      ('role_sync', 120, 5, 240, 'minutes', 5, 'Combined sync for Subscribers, VIPs, and Moderators'),
      ('followers', 120, 5, 240, 'minutes', 5, 'Detect new followers and trigger alerts'),
      ('moderation', 120, 5, 240, 'minutes', 5, 'Track ban/timeout/unban moderation actions')
  `);

  // ===== CHAT COMMANDS SYSTEM =====

  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_commands_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      command_name TEXT UNIQUE NOT NULL,
      command_prefix TEXT NOT NULL DEFAULT '~',
      enabled INTEGER DEFAULT 1,
      permission_level TEXT NOT NULL CHECK (permission_level IN ('viewer', 'moderator', 'broadcaster')),
      rate_limit_seconds INTEGER DEFAULT 5,
      custom_response TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_command_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      command_name TEXT NOT NULL,
      viewer_id TEXT NOT NULL,
      viewer_username TEXT NOT NULL,
      executed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      success INTEGER DEFAULT 1,
      error_message TEXT,
      FOREIGN KEY (viewer_id) REFERENCES viewers(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_chat_commands_enabled ON chat_commands_config(enabled)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_chat_commands_permission ON chat_commands_config(permission_level)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_command_usage_viewer ON chat_command_usage(viewer_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_command_usage_executed ON chat_command_usage(executed_at)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_command_usage_command ON chat_command_usage(command_name)
  `);
  db.exec(`
    INSERT OR IGNORE INTO chat_commands_config (command_name, command_prefix, enabled, permission_level, rate_limit_seconds)
    VALUES 
      ('hello', '~', 1, 'viewer', 30),
      ('voices', '~', 1, 'viewer', 60),
      ('setvoice', '~', 1, 'viewer', 10),
      ('setvoicepitch', '~', 1, 'viewer', 10),
      ('setvoicespeed', '~', 1, 'viewer', 10),
      ('mutevoice', '~', 1, 'moderator', 5),
      ('unmutevoice', '~', 1, 'moderator', 5),
      ('cooldownvoice', '~', 1, 'moderator', 5),
      ('mutetts', '~', 1, 'moderator', 30),
      ('unmutetts', '~', 1, 'moderator', 30)
  `);
  // ===== BROWSER SOURCE CHANNELS (Phase 10.5) =====

  db.exec(`
    CREATE TABLE IF NOT EXISTS browser_source_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#9147ff',
      icon TEXT DEFAULT '📺',
      is_default BOOLEAN DEFAULT 0,
      is_enabled BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      
      -- One channel per name per Twitch channel
      UNIQUE(channel_id, name)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_browser_source_channels_channel ON browser_source_channels(channel_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_browser_source_channels_name ON browser_source_channels(name)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_browser_source_channels_default ON browser_source_channels(is_default)
  `);

  // ===== EVENT ACTIONS (Phase 2) =====

  db.exec(`
    CREATE TABLE IF NOT EXISTS event_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      is_enabled BOOLEAN DEFAULT 1,
      
      -- Browser Source Channel Assignment (Phase 10.5)
      browser_source_channel TEXT DEFAULT 'default',
      
      -- Text Configuration
      text_enabled BOOLEAN DEFAULT 0,
      text_template TEXT,
      text_duration INTEGER DEFAULT 5000,
      text_position TEXT DEFAULT 'top-center',
      text_style TEXT,
      
      -- Sound Configuration
      sound_enabled BOOLEAN DEFAULT 0,
      sound_file_path TEXT,
      sound_volume REAL DEFAULT 1.0,
      
      -- Image Configuration
      image_enabled BOOLEAN DEFAULT 0,
      image_file_path TEXT,
      image_duration INTEGER DEFAULT 5000,
      image_position TEXT DEFAULT 'center',
      image_width INTEGER,
      image_height INTEGER,
      
      -- Video Configuration
      video_enabled BOOLEAN DEFAULT 0,
      video_file_path TEXT,
      video_volume REAL DEFAULT 1.0,
      video_position TEXT DEFAULT 'center',
      video_width INTEGER,
      video_height INTEGER,
      
      -- Metadata
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      
      -- One action per event type per channel
      UNIQUE(channel_id, event_type)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_event_actions_channel ON event_actions(channel_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_event_actions_event_type ON event_actions(event_type)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_event_actions_enabled ON event_actions(is_enabled)
  `);  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_event_actions_channel_event ON event_actions(channel_id, event_type)
  `);

  // ===== DISCORD BOT CONFIGURATION (Phase 2) =====

  db.exec(`
    CREATE TABLE IF NOT EXISTS discord_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      bot_token TEXT,
      bot_id TEXT,
      bot_status TEXT DEFAULT 'disconnected',
      last_connected_at DATETIME,
      last_disconnected_at DATETIME,
      auto_start_enabled BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    INSERT OR IGNORE INTO discord_settings (id, bot_status) VALUES (1, 'disconnected')
  `);

  console.log('[Migrations] Database schema initialization complete');
}
