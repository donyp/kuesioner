import { getDb } from '../db/index.js';

export function getSetting(key, fallback = null) {
  try {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
    if (!row) return fallback;
    return JSON.parse(row.value);
  } catch { return fallback; }
}

export function setSetting(key, value) {
  getDb().prepare('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run(key, JSON.stringify(value));
}
