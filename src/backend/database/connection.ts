import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';
import { runMigrations } from './migrations';

let db: Database.Database | null = null;

export function initializeDatabase(): Database.Database {
  if (db) {
    return db;
  }

  // Store database in user data directory (persists across app updates)
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'stream-synth.db');

  console.log('Initializing database at:', dbPath);

  db = new Database(dbPath);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Run migrations to create tables
  runMigrations(db);

  console.log('Database initialized successfully');
  
  return db;
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    console.log('Database closed');
  }
}
