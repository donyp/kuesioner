import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

let _db = null;

export function resolvePath(p) {
  if (!p) return p;
  if (path.isAbsolute(p)) return p;
  return path.resolve(PROJECT_ROOT, p);
}

export function getDb() {
  if (_db) return _db;
  const dbPath = resolvePath(process.env.DB_PATH || './data/app.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  _db = new DatabaseSync(dbPath);
  _db.exec('PRAGMA journal_mode = WAL;');
  _db.exec('PRAGMA foreign_keys = ON;');
  return _db;
}

export function closeDb() {
  if (_db) { _db.close(); _db = null; }
}