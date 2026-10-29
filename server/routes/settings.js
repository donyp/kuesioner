import { z } from 'zod';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

export default async function settingsRoutes(app) {
  app.get('/', { preHandler: requireAuth }, async () => {
    const rows = getDb().prepare('SELECT key, value FROM settings').all();
    const out = {};
    for (const r of rows) { try { out[r.key] = JSON.parse(r.value); } catch { out[r.key] = r.value; } }
    return {
      siteName: out.siteName || 'Kuesioner',
      turnstile: out.turnstile || { enabled: false, siteKey: process.env.TURNSTILE_SITE_KEY || '' },
      retentionDays: out.retentionDays || 0,
    };
  });

  app.put('/', { preHandler: requireAuth }, async (req, reply) => {
    const schema = z.object({
      siteName: z.string().max(100).optional(),
      turnstile: z.object({ enabled: z.boolean(), siteKey: z.string().optional() }).optional(),
      retentionDays: z.number().int().min(0).max(365).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const db = getDb();
    const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
    if (parsed.data.siteName !== undefined) upsert.run('siteName', JSON.stringify(parsed.data.siteName));
    if (parsed.data.turnstile !== undefined) upsert.run('turnstile', JSON.stringify(parsed.data.turnstile));
    if (parsed.data.retentionDays !== undefined) upsert.run('retentionDays', JSON.stringify(parsed.data.retentionDays));
    return { ok: true };
  });
}