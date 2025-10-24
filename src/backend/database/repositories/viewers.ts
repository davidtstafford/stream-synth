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
   */
  getOrCreate(id: string, username: string, displayName?: string): Viewer | null {
    const db = getDatabase();
    // Require numeric IDs (Twitch user IDs). If id is not numeric, do not create a viewer row.
    if (!/^[0-9]+$/.test(id)) {
      // Do not create entries with username-only IDs
      return null;
    }
    // Try to get existing viewer
    const existing = this.getById(id);
    if (existing) {
      // Update if display name changed
      if (displayName && displayName !== existing.display_name) {
        const updateStmt = db.prepare(`
          UPDATE viewers 
          SET display_name = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);
        updateStmt.run(displayName, id);
        existing.display_name = displayName;
      }
      return existing;
    }

    // Create new viewer
    const stmt = db.prepare(`
      INSERT INTO viewers (id, username, display_name)
      VALUES (?, ?, ?)
    `);
    stmt.run(id, username, displayName || null);

    return this.getById(id)!;
  }

  /**
   * Get viewer by ID
   */
  getById(id: string): Viewer | null {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM viewers WHERE id = ?
    `);
    return stmt.get(id) as Viewer | null;
  }

  /**
   * Get all viewers
   */
  getAll(limit?: number, offset?: number): Viewer[] {
    const db = getDatabase();
    let query = `SELECT * FROM viewers ORDER BY username`;
    
    if (limit) {
      query += ` LIMIT ${limit}`;
    }
    if (offset) {
      query += ` OFFSET ${offset}`;
    }

    const stmt = db.prepare(query);
    return stmt.all() as Viewer[];
  }

  /**
   * Search viewers by username or display name
   */
  search(query: string, limit: number = 50): Viewer[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM viewers 
      WHERE username LIKE ? OR display_name LIKE ?
      ORDER BY username
      LIMIT ?
    `);
    const searchParam = `%${query}%`;
    return stmt.all(searchParam, searchParam, limit) as Viewer[];
  }

  /**
   * Delete a viewer
   */
  delete(id: string): void {
    const db = getDatabase();
    const stmt = db.prepare(`DELETE FROM viewers WHERE id = ?`);
    stmt.run(id);
  }

  /**
   * Delete all viewers
   */
  deleteAll(): void {
    const db = getDatabase();
    db.prepare(`DELETE FROM viewers`).run();
  }

  /**
   * Get viewer count
   */
  getCount(): number {
    const db = getDatabase();
    const result = db.prepare(`SELECT COUNT(*) as count FROM viewers`).get() as { count: number };
    return result.count;
  }
}
