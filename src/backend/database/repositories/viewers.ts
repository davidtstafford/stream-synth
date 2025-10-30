import { BaseRepository } from '../base-repository';

export interface Viewer {
  id: string;
  username: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export class ViewersRepository extends BaseRepository<Viewer> {
  get tableName(): string {
    return 'viewers';
  }

  /**
   * Get viewer by ID
   */
  getViewerById(id: string): Viewer | null {
    return super.getById(id, 'id');
  }

  /**
   * Get all viewers with optional limit and offset
   */
  getAllViewers(limit?: number, offset?: number): Viewer[] {
    const db = this.getDatabase();
    let query = `SELECT * FROM viewers ORDER BY username`;
    
    if (limit) {
      query += ` LIMIT ${limit}`;
    }
    if (offset) {
      query += ` OFFSET ${offset}`;
    }

    return db.prepare(query).all() as Viewer[];
  }

  /**
   * Delete a viewer by ID
   */
  deleteViewer(id: string): void {
    const db = this.getDatabase();
    db.prepare(`DELETE FROM viewers WHERE id = ?`).run(id);
  }

  /**
   * Get or create a viewer
   * Validates that ID is numeric (Twitch requirement)
   * Updates display name if it has changed
   */
  getOrCreate(id: string, username: string, displayName?: string): Viewer | null {
    const db = this.getDatabase();
    
    // Require numeric IDs (Twitch user IDs)
    if (!/^[0-9]+$/.test(id)) {
      return null;
    }

    // Try to get existing viewer
    const existing = this.getViewerById(id);
    if (existing) {
      // Update if display name changed
      if (displayName && displayName !== existing.display_name) {
        db.prepare(`
          UPDATE viewers 
          SET display_name = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(displayName, id);
        existing.display_name = displayName;
      }
      return existing;
    }

    // Create new viewer
    db.prepare(`
      INSERT INTO viewers (id, username, display_name)
      VALUES (?, ?, ?)
    `).run(id, username, displayName || null);

    return this.getViewerById(id)!;
  }

  /**
   * Search viewers by username or display name
   */
  search(query: string, limit: number = 50): Viewer[] {
    const db = this.getDatabase();
    const searchParam = `%${query}%`;
    return db.prepare(`
      SELECT * FROM viewers 
      WHERE username LIKE ? OR display_name LIKE ?
      ORDER BY username
      LIMIT ?
    `).all(searchParam, searchParam, limit) as Viewer[];
  }
  /**
   * Get viewer by username
   */
  getByUsername(username: string): Viewer | null {
    const db = this.getDatabase();
    const row = db.prepare(`
      SELECT * FROM viewers WHERE username = ? COLLATE NOCASE
    `).get(username);
    
    return row as Viewer | null;
  }

  /**
   * Delete all viewers
   */
  deleteAllViewers(): void {
    const db = this.getDatabase();
    db.prepare(`DELETE FROM viewers`).run();
  }

  /**
   * Get viewer count
   */
  getCount(): number {
    const db = this.getDatabase();
    const result = db.prepare(`SELECT COUNT(*) as count FROM viewers`).get() as { count: number };
    return result.count;
  }
}
