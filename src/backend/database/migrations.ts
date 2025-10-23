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

  console.log('Database migrations completed');
}
