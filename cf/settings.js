import { first, run, parseJson } from './db.js';

export async function getSetting(c, key, fallback = null) {
  const row = await first(c, 'SELECT value FROM settings WHERE key = ?', key);
  if (!row) return fallback;
  return parseJson(row.value, fallback);
}

export async function setSetting(c, key, value) {
  await run(
    c,
    'INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    key, JSON.stringify(value)
  );
}
