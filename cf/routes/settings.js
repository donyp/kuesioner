import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { getSetting, setSetting } from '../settings.js';

const settings = new Hono();

settings.get('/', requireAuth, async (c) => {
  return c.json({
    siteName: await getSetting(c, 'siteName', 'Kuesioner'),
    turnstile: await getSetting(c, 'turnstile', { enabled: false, siteKey: '' }),
    retentionDays: await getSetting(c, 'retentionDays', 0),
  });
});

settings.put('/', requireAuth, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({
    siteName: z.string().max(100).optional(),
    turnstile: z.object({ enabled: z.boolean(), siteKey: z.string().optional() }).optional(),
    retentionDays: z.number().int().min(0).max(365).optional(),
  }).safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  if (parsed.data.siteName !== undefined) await setSetting(c, 'siteName', parsed.data.siteName);
  if (parsed.data.turnstile !== undefined) await setSetting(c, 'turnstile', parsed.data.turnstile);
  if (parsed.data.retentionDays !== undefined) await setSetting(c, 'retentionDays', parsed.data.retentionDays);
  return c.json({ ok: true });
});

export default settings;
