import { all, run } from './db.js';
import { getSetting } from './settings.js';

export async function deleteKeys(c, keys) {
  for (const key of keys) {
    try { await c.env.BUCKET.delete(key); } catch {}
  }
}

export async function deleteFormFiles(c, formId) {
  const rows = await all(c, 'SELECT path FROM files WHERE form_id = ?', formId);
  await deleteKeys(c, rows.map(r => r.path));
}

export async function cleanupExpiredFiles(c) {
  const days = await getSetting(c, 'retentionDays', 0);
  if (!days || days <= 0) return { removed: 0 };
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString().replace('T', ' ').slice(0, 19);
  const rows = await all(c, 'SELECT id, path FROM files WHERE created_at < ?', cutoff);
  await deleteKeys(c, rows.map(r => r.path));
  for (const r of rows) {
    await run(c, 'DELETE FROM files WHERE id = ?', r.id);
  }
  return { removed: rows.length };
}
