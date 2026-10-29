import fs from 'node:fs';
import path from 'node:path';
import { getDb, resolvePath } from '../db/index.js';

function getRetentionDays() {
  try {
    const row = getDb().prepare("SELECT value FROM settings WHERE key = 'retentionDays'").get();
    if (!row) return 0;
    const v = JSON.parse(row.value);
    return Number.isFinite(v) ? v : 0;
  } catch { return 0; }
}

export function cleanupExpiredFiles() {
  const days = getRetentionDays();
  if (!days || days <= 0) return { removed: 0 }; // 0 = keep until form deleted
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
  const db = getDb();
  const rows = db.prepare('SELECT id, path FROM files WHERE created_at < ?').all(cutoff.replace('T', ' ').slice(0, 19));
  let removed = 0;
  for (const r of rows) {
    try { fs.unlinkSync(resolvePath(r.path)); } catch {}
    db.prepare('DELETE FROM files WHERE id = ?').run(r.id);
    removed++;
  }
  return { removed };
}

export function startCleanupJob() {
  try { cleanupExpiredFiles(); } catch {}
  const t = setInterval(() => { try { cleanupExpiredFiles(); } catch {} }, 6 * 3600_000);
  t.unref?.();
  return t;
}