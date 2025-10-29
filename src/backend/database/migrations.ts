import Database from 'better-sqlite3';

export function runMigrations(db: Database.Database): void {
  console.log('[Migrations] Starting database schema initialization...');

  // ===== Core Tables =====
  
  // Create app_settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create connection_sessions table
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

  // Create event_subscriptions table
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

  // Create oauth_tokens table
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

  // Create viewers table
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
  // Create index on username for faster lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_viewers_username ON viewers(username)
  `);

  // Create viewer_subscriptions table
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

  // Create index on viewer_id for faster lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_subscriptions_viewer ON viewer_subscriptions(viewer_id)
  `);
  // Create view combining viewer info with subscription status
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
      -- Add role information
      (SELECT 1 FROM viewer_roles WHERE viewer_id = v.id AND role_type = 'vip' AND revoked_at IS NULL) AS is_vip,
      (SELECT 1 FROM viewer_roles WHERE viewer_id = v.id AND role_type = 'moderator' AND revoked_at IS NULL) AS is_moderator,
      (SELECT 1 FROM viewer_roles WHERE viewer_id = v.id AND role_type = 'broadcaster' AND revoked_at IS NULL) AS is_broadcaster
    FROM viewers v
    LEFT JOIN viewer_subscriptions vs ON v.id = vs.viewer_id
  `);

  // Create events table
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

  // Create indexes for faster queries
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

  // Create tts_settings table for TTS configuration
  db.exec(`
    CREATE TABLE IF NOT EXISTS tts_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert default TTS settings if not exists
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
      ('max_queue_size', '20'),
      ('max_emotes_per_message', '5'),
      ('max_emojis_per_message', '3'),
      ('strip_excessive_emotes', 'true'),      ('max_repeated_chars', '3'),
      ('max_repeated_words', '2'),
      ('copypasta_filter_enabled', 'false'),
      ('blocked_words', '[]')
  `);  // Create WebSpeech voices table
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

  // Create indexes for WebSpeech voices
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_webspeech_voices_numeric_id ON webspeech_voices(numeric_id)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_webspeech_voices_language ON webspeech_voices(language_name)
  `);
  // Create Azure voices table
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

  // Create indexes for Azure voices
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_azure_voices_numeric_id ON azure_voices(numeric_id)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_azure_voices_language ON azure_voices(language_name)
  `);
  // Create Google voices table
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

  // Create indexes for Google voices
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_google_voices_numeric_id ON google_voices(numeric_id)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_google_voices_language ON google_voices(language_name)
  `);

  // Create view combining all voices
  db.exec(`
    CREATE VIEW IF NOT EXISTS all_voices AS
    SELECT * FROM webspeech_voices
    UNION ALL
    SELECT * FROM azure_voices
    UNION ALL
    SELECT * FROM google_voices
  `);
  // Create tts_provider_status table to track voice sync state per provider
  db.exec(`
    CREATE TABLE IF NOT EXISTS tts_provider_status (
      provider TEXT PRIMARY KEY,
      is_enabled INTEGER DEFAULT 1,
      last_synced_at TEXT,
      voice_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )  `);

  // ===== TTS Access & Enablement Tables =====
    // Create tts_access_config table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tts_access_config (
      id INTEGER PRIMARY KEY DEFAULT 1,
      access_mode TEXT NOT NULL DEFAULT 'access_all',
      
      -- Limited Access Rules
      limited_allow_subscribers INTEGER DEFAULT 1,
      limited_deny_gifted_subs INTEGER DEFAULT 0,
      limited_allow_vip INTEGER DEFAULT 0,
      limited_allow_mod INTEGER DEFAULT 0,
      limited_redeem_name TEXT,
      limited_redeem_duration_mins INTEGER,
      
      -- Premium Voice Access Rules
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

  // Insert default config if not exists
  db.exec(`
    INSERT OR IGNORE INTO tts_access_config (id, access_mode) 
    VALUES (1, 'access_all')
  `);

  // Create viewer_voice_preferences table
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
  // Create viewer_roles table for role tracking (VIP, Moderator, Broadcaster)
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

  // Create channel_point_grants table for temporary access
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
  `);  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_grants_active ON channel_point_grants(viewer_id, expires_at)
  `);

  // ===== Twitch API Polling Configuration =====
  
  // Create twitch_polling_config table for flexible API polling intervals
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
      CHECK (api_type IN ('role_sync', 'followers'))
    )
  `);

  // Upsert default polling configs
  // Only updates description/min/max/units/step (build-controlled), preserves user settings (interval_value, enabled)
  db.exec(`
    INSERT INTO twitch_polling_config (
      api_type, interval_value, min_interval, max_interval, interval_units, step, description
    ) VALUES 
      ('role_sync', 30, 5, 120, 'minutes', 5, 'Combined sync for Subscribers, VIPs, and Moderators'),
      ('followers', 120, 60, 600, 'seconds', 10, 'Detect new followers and trigger alerts')
    ON CONFLICT(api_type) DO UPDATE SET 
      description = excluded.description,
      min_interval = excluded.min_interval,
      max_interval = excluded.max_interval,
      interval_units = excluded.interval_units,
      step = excluded.step,
      updated_at = CURRENT_TIMESTAMP
  `);

  console.log('Database migrations completed');
}
