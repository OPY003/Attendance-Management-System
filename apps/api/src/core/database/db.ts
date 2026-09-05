import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { CREATE_TABLES_SQL } from './schema.js';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite');

let dbInstance: any = null;

export function getDatabase(dbPath?: string): any {
  if (dbInstance) return dbInstance;

  const targetPath = dbPath || process.env.DATABASE_FILE || path.resolve(process.cwd(), 'uapms.sqlite');
  
  // If not in-memory, ensure parent directory exists
  if (targetPath !== ':memory:') {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  dbInstance = new DatabaseSync(targetPath);
  dbInstance.exec('PRAGMA journal_mode = WAL;');
  dbInstance.exec('PRAGMA foreign_keys = ON;');

  // Run schema creation
  dbInstance.exec(CREATE_TABLES_SQL);

  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Helper to run parameterized query returning array of rows
 */
export function query<T = any>(sql: string, params: any[] = []): T[] {
  const db = getDatabase();
  const stmt = db.prepare(sql);
  return stmt.all(...params) as T[];
}

/**
 * Helper to run parameterized query returning single row
 */
export function queryOne<T = any>(sql: string, params: any[] = []): T | undefined {
  const db = getDatabase();
  const stmt = db.prepare(sql);
  return stmt.get(...params) as T | undefined;
}

/**
 * Helper to run insert / update / delete query
 */
export function execute(sql: string, params: any[] = []): { changes: number | bigint; lastInsertRowid: number | bigint } {
  const db = getDatabase();
  const stmt = db.prepare(sql);
  return stmt.run(...params);
}

/**
 * Run operations within a transaction
 */
export function transaction<T>(callback: (db: any) => T): T {
  const db = getDatabase();
  db.exec('BEGIN TRANSACTION;');
  try {
    const result = callback(db);
    db.exec('COMMIT;');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch {}
    throw err;
  }
}
