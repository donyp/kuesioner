import { Hono } from 'hono';
import { all, first, run } from '../db.js';
import { getSetting } from '../settings.js';
import { cleanupExpiredFiles } from '../files.js';

const pub = new Hono();

pub.get('/public/settings', async (c) => {
  const t = await getSetting(c, 'turnstile', { enabled: false, siteKey: '' });
  return c.json({
    siteName: await getSetting(c, 'siteName', 'Kuesioner'),
    turnstile: { enabled: !!t?.enabled, siteKey: t?.siteKey || '' },
  });
});

pub.get('/f/:slug', async (c) => {
  const form = await first(c, 'SELECT * FROM forms WHERE slug = ?', c.req.param('slug'));
  if (!form) return c.json({ error: 'Form not found' }, 404);
  if (form.status !== 'published') return c.json({ error: 'Form not available' }, 403);

  const questions = await all(c, 'SELECT * FROM questions WHERE form_id = ? ORDER BY position, id', form.id);

  const today = new Date().toISOString().slice(0, 10);
  await run(c, `
    INSERT INTO form_views (form_id, date, count) VALUES (?,?,1)
    ON CONFLICT(form_id, date) DO UPDATE SET count = count + 1
  `, form.id, today);

  try { c.executionCtx.waitUntil(cleanupExpiredFiles(c)); } catch {}

  return c.json({
    id: form.id,
    title: form.title,
    description: form.description,
    slug: form.slug,
    accent_color: form.accent_color,
    settings: JSON.parse(form.settings_json || '{}'),
    questions: questions.map(q => ({
      id: q.id,
      type: q.type,
      title: q.title,
      description: q.description,
      required: !!q.required,
      options: JSON.parse(q.options_json || '[]'),
      validation: JSON.parse(q.validation_json || '{}'),
    })),
  });
});

export default pub;
