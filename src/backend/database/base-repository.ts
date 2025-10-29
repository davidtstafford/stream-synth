/**
 * Base Repository Pattern
 * 
 * Eliminates CRUD boilerplate across all repository files
 * Provides standardized query building and error handling
 */

import { getDatabase } from './connection';

export interface RepositoryRow {
  [key: string]: any;
}

/**
 * Abstract base class for all repositories
 * Provides standardized CRUD operations and query building
 */
export abstract class BaseRepository<T extends RepositoryRow, R extends RepositoryRow = T> {
  /**
   * Must be implemented by subclasses
   */
  abstract get tableName(): string;

  /**
   * Map database row to domain object
   * Override if domain object differs from database row
   */
  protected mapRow(row: R): T {
    return row as any;
  }

  /**
   * Get database connection
   */
  protected getDatabase() {
    return getDatabase();
  }

  /**
   * Get single record by ID
   */
  protected getById(id: any, idColumn: string = 'id'): T | null {
    const db = this.getDatabase();
    const stmt = db.prepare(
      `SELECT * FROM ${this.tableName} WHERE ${idColumn} = ? LIMIT 1`
    );
    const row = stmt.get(id) as R | undefined;
    return row ? this.mapRow(row) : null;
  }

  /**
   * Get multiple records by IDs
   */
  protected getByIds(ids: any[], idColumn: string = 'id'): T[] {
    if (ids.length === 0) return [];

    const db = this.getDatabase();
    const placeholders = ids.map(() => '?').join(',');
    const stmt = db.prepare(
      `SELECT * FROM ${this.tableName} WHERE ${idColumn} IN (${placeholders})`
    );
    const rows = stmt.all(...ids) as R[];
    return rows.map(r => this.mapRow(r));
  }

  /**
   * Get all records with optional where clause and ordering
   */
  protected getAll(
    where?: Record<string, any>,
    orderBy?: string,
    limit?: number
  ): T[] {
    let query = `SELECT * FROM ${this.tableName}`;
    const params: any[] = [];

    if (where && Object.keys(where).length > 0) {
      const whereClause = Object.entries(where)
        .map(([key, value]) => {
          params.push(value);
          return `${key} = ?`;
        })
        .join(' AND ');
      query += ` WHERE ${whereClause}`;
    }

    if (orderBy) {
      query += ` ORDER BY ${orderBy}`;
    }

    if (limit) {
      query += ` LIMIT ${limit}`;
    }

    const db = this.getDatabase();
    const stmt = db.prepare(query);
    const rows = stmt.all(...params) as R[];
    return rows.map(r => this.mapRow(r));
  }

  /**
   * Count records with optional where clause
   */
  protected count(where?: Record<string, any>): number {
    let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const params: any[] = [];

    if (where && Object.keys(where).length > 0) {
      const whereClause = Object.entries(where)
        .map(([key, value]) => {
          params.push(value);
          return `${key} = ?`;
        })
        .join(' AND ');
      query += ` WHERE ${whereClause}`;
    }

    const db = this.getDatabase();
    const stmt = db.prepare(query);
    const result = stmt.get(...params) as { count: number } | undefined;
    return result?.count || 0;
  }

  /**
   * Insert or replace a record
   */
  protected upsert(data: Record<string, any>, conflictKeys: string[]): void {
    const db = this.getDatabase();
    const cols = Object.keys(data);
    const placeholders = cols.map(() => '?').join(',');
    const updates = cols.map(c => `${c} = excluded.${c}`).join(',');
    const conflictKeyStr = conflictKeys.join(', ');

    const query = `
      INSERT INTO ${this.tableName} (${cols.join(',')})
      VALUES (${placeholders})
      ON CONFLICT(${conflictKeyStr}) DO UPDATE SET ${updates}
    `;

    const stmt = db.prepare(query);
    stmt.run(...Object.values(data));
  }

  /**
   * Insert a single record
   */
  protected insert(data: Record<string, any>): void {
    const db = this.getDatabase();
    const cols = Object.keys(data);
    const placeholders = cols.map(() => '?').join(',');

    const query = `INSERT INTO ${this.tableName} (${cols.join(',')}) VALUES (${placeholders})`;
    const stmt = db.prepare(query);
    stmt.run(...Object.values(data));
  }

  /**
   * Insert multiple records
   */
  protected insertMany(dataArray: Record<string, any>[]): void {
    if (dataArray.length === 0) return;

    const db = this.getDatabase();
    const cols = Object.keys(dataArray[0]);
    const placeholders = cols.map(() => '?').join(',');

    const query = `INSERT INTO ${this.tableName} (${cols.join(',')}) VALUES (${placeholders})`;
    const stmt = db.prepare(query);

    for (const data of dataArray) {
      stmt.run(...Object.values(data));
    }
  }

  /**
   * Update records matching where clause
   */
  protected update(data: Record<string, any>, where: Record<string, any>): number {
    const db = this.getDatabase();
    const setCols = Object.entries(data).map(([k, v]) => `${k} = ?`).join(',');
    const whereParams: any[] = [];
    const whereClause = Object.entries(where)
      .map(([k, v]) => {
        whereParams.push(v);
        return `${k} = ?`;
      })
      .join(' AND ');

    const query = `UPDATE ${this.tableName} SET ${setCols} WHERE ${whereClause}`;
    const stmt = db.prepare(query);
    const info = stmt.run(...Object.values(data), ...whereParams);
    return info.changes;
  }

  /**
   * Delete records matching where clause
   */
  protected delete(where: Record<string, any>): number {
    const db = this.getDatabase();
    const params: any[] = [];
    const whereClause = Object.entries(where)
      .map(([k, v]) => {
        params.push(v);
        return `${k} = ?`;
      })
      .join(' AND ');

    const query = `DELETE FROM ${this.tableName} WHERE ${whereClause}`;
    const stmt = db.prepare(query);
    const info = stmt.run(...params);
    return info.changes;
  }

  /**
   * Delete by ID
   */
  protected deleteById(id: any, idColumn: string = 'id'): number {
    return this.delete({ [idColumn]: id });
  }

  /**
   * Delete all records
   */
  protected deleteAll(): number {
    const db = this.getDatabase();
    const stmt = db.prepare(`DELETE FROM ${this.tableName}`);
    const info = stmt.run();
    return info.changes;
  }

  /**
   * Check if record exists
   */
  protected exists(where: Record<string, any>): boolean {
    return this.count(where) > 0;
  }

  /**
   * Execute raw SQL query
   */
  protected query<R extends RepositoryRow>(sql: string, params: any[] = []): R[] {
    const db = this.getDatabase();
    const stmt = db.prepare(sql);
    return stmt.all(...params) as R[];
  }

  /**
   * Execute raw SQL query returning single row
   */
  protected queryOne<R extends RepositoryRow>(sql: string, params: any[] = []): R | null {
    const db = this.getDatabase();
    const stmt = db.prepare(sql);
    return (stmt.get(...params) as R | undefined) || null;
  }

  /**
   * Execute raw SQL query returning scalar value
   */
  protected queryScalar<T = any>(sql: string, params: any[] = []): T | null {
    const db = this.getDatabase();
    const stmt = db.prepare(sql);
    const result = stmt.get(...params) as Record<string, any> | undefined;
    if (!result) return null;
    // Get first value
    const firstValue = Object.values(result)[0];
    return firstValue as T || null;
  }
}
