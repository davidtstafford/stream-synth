import { getDatabase } from '../connection';

export interface Viewer {
  id: string;
  username: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export class ViewersRepository {
  /**
   * Get or create a viewer
   * Returns the viewer record, creating it if it doesn't exist
   */
  getOrCreate(id: string, username: string, displayName?: string): Viewer {
    const db = getDatabase();
    
    // First try to get existing viewer
    const existing = db.prepare('SELECT * FROM viewers WHERE id = ?').get(id) as Viewer | undefined;
    
    if (existing) {
      // Update username and display_name if changed
      if (existing.username !== username || existing.display_name !== displayName) {
        db.prepare(`
          UPDATE viewers 
          SET username = ?, display_name = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(username, displayName || null, id);
        
        return {
          ...existing,
          username,
          display_name: displayName || null,
          updated_at: new Date().toISOString()
        };
      }
      return existing;
    }
    
    // Create new viewer
    db.prepare(`
      INSERT INTO viewers (id, username, display_name)
      VALUES (?, ?, ?)
    `).run(id, username, displayName || null);
    
    return {
      id,
      username,
      display_name: displayName || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Get a viewer by ID
   */
  getById(id: string): Viewer | null {
    const db = getDatabase();
    const viewer = db.prepare('SELECT * FROM viewers WHERE id = ?').get(id) as Viewer | undefined;
    return viewer || null;
  }

  /**
   * Get a viewer by username
   */
  getByUsername(username: string): Viewer | null {
    const db = getDatabase();
    const viewer = db.prepare('SELECT * FROM viewers WHERE username = ?').get(username) as Viewer | undefined;
    return viewer || null;
  }

  /**
   * Get all viewers
   */
  getAll(limit: number = 100, offset: number = 0): Viewer[] {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM viewers 
      ORDER BY updated_at DESC 
      LIMIT ? OFFSET ?
    `).all(limit, offset) as Viewer[];
  }

  /**
   * Search viewers by username or display name
   */
  search(query: string, limit: number = 100): Viewer[] {
    const db = getDatabase();
    const searchPattern = `%${query}%`;
    return db.prepare(`
      SELECT * FROM viewers 
      WHERE username LIKE ? OR display_name LIKE ?
      ORDER BY updated_at DESC 
      LIMIT ?
    `).all(searchPattern, searchPattern, limit) as Viewer[];
  }
}
