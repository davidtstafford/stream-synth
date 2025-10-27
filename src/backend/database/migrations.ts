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
  // Create WebSpeech voices table
  db.exec(`
    CREATE TABLE IF NOT EXISTS webspeech_voices (
      voice_id TEXT PRIMARY KEY,
      numeric_id INTEGER UNIQUE,
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
      voice_id TEXT PRIMARY KEY,
      numeric_id INTEGER UNIQUE,
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
      voice_id TEXT PRIMARY KEY,
      numeric_id INTEGER UNIQUE,
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
    )
  `);
  // Create viewer_tts_rules table for per-viewer TTS overrides
  db.exec(`
    CREATE TABLE IF NOT EXISTS viewer_tts_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      custom_voice_id INTEGER,
      pitch_override REAL,
      rate_override REAL,
      is_muted INTEGER DEFAULT 0,
      muted_until TEXT,
      cooldown_enabled INTEGER DEFAULT 0,
      cooldown_seconds INTEGER,
      cooldown_until TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_viewer_tts_rules_username ON viewer_tts_rules(username)
  `);

  // Migration: Add cooldown_enabled and cooldown_until columns if they don't exist
  try {
    // Get table info to check if columns exist
    const tableInfo = db.prepare("PRAGMA table_info(viewer_tts_rules)").all() as any[];
    const hasColumns = tableInfo.some(col => col.name === 'cooldown_enabled');
    
    if (!hasColumns) {
      console.log('Adding cooldown_enabled and cooldown_until columns to viewer_tts_rules');
      db.exec(`ALTER TABLE viewer_tts_rules ADD COLUMN cooldown_enabled INTEGER DEFAULT 0`);
      db.exec(`ALTER TABLE viewer_tts_rules ADD COLUMN cooldown_until TEXT`);
      console.log('Cooldown columns added successfully');
    } else {
      console.log('Cooldown columns already exist');
    }
  } catch (err) {
    console.log('Error checking/adding cooldown columns:', err);
  }

  console.log('Database migrations completed');
}
