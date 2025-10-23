import Database from 'better-sqlite3';

export function runMigrations(db: Database.Database): void {
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
      ('duplicate_message_window', '300'),
      ('user_cooldown_enabled', 'true'),
      ('user_cooldown_seconds', '30'),
      ('global_cooldown_enabled', 'false'),
      ('global_cooldown_seconds', '5'),
      ('max_queue_size', '20'),
      ('max_emotes_per_message', '5'),
      ('max_emojis_per_message', '3'),
      ('strip_excessive_emotes', 'true'),
      ('max_repeated_chars', '3'),
      ('max_repeated_words', '2'),
      ('copypasta_filter_enabled', 'false')
  `);

  // Create tts_voices table for discovered voices
  db.exec(`
    CREATE TABLE IF NOT EXISTS tts_voices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voice_id TEXT NOT NULL UNIQUE,
      provider TEXT NOT NULL,
      source TEXT,
      name TEXT NOT NULL,
      language_code TEXT NOT NULL,
      language_name TEXT NOT NULL,
      region TEXT,
      gender TEXT,
      is_available INTEGER DEFAULT 1,
      display_order INTEGER,
      last_seen_at TEXT,
      created_at TEXT NOT NULL,
      metadata TEXT
    )
  `);

  // Create indexes for voices table
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tts_voices_provider ON tts_voices(provider)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tts_voices_available ON tts_voices(is_available)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tts_voices_language ON tts_voices(language_code)
  `);

  // Create tts_voice_ids table for numeric ID mapping
  db.exec(`
    CREATE TABLE IF NOT EXISTS tts_voice_ids (
      numeric_id INTEGER PRIMARY KEY AUTOINCREMENT,
      voice_id TEXT NOT NULL UNIQUE,
      FOREIGN KEY (voice_id) REFERENCES tts_voices(voice_id)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tts_voice_ids_lookup ON tts_voice_ids(voice_id)
  `);

  console.log('Database migrations completed');
}
