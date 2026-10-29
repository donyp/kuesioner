import { Hono } from 'hono';
import { z } from 'zod';
import { all, first, run, stmt } from '../db.js';
import { requireAuth } from '../auth.js';
import { deleteFormFiles } from '../files.js';

const forms = new Hono();

function slugify(s) {
  return String(s).toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60) || 'form';
}

forms.get('/', requireAuth, async (c) => {
  return c.json(await all(c, `
    SELECT f.*,
      (SELECT COUNT(*) FROM submissions s WHERE s.form_id = f.id) AS submission_count,
      (SELECT COUNT(*) FROM questions q WHERE q.form_id = f.id) AS question_count
    FROM forms f ORDER BY f.updated_at DESC
  `));
});

forms.post('/', requireAuth, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional().default(''),
    slug: z.string().optional(),
    status: z.enum(['draft', 'published', 'closed']).optional().default('draft'),
    accent_color: z.string().optional().default('#7C5CFC'),
    settings: z.record(z.any()).optional().default({}),
  }).safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const d = parsed.data;
  let slug = d.slug ? slugify(d.slug) : slugify(d.title);
  const exists = await first(c, 'SELECT id FROM forms WHERE slug = ?', slug);
  if (exists) slug = `${slug}-${Date.now().toString(36)}`;

  const info = await run(c, `
    INSERT INTO forms (title, description, slug, status, accent_color, settings_json)
    VALUES (?,?,?,?,?,?)
  `, d.title, d.description, slug, d.status, d.accent_color, JSON.stringify(d.settings));

  return c.json(await first(c, 'SELECT * FROM forms WHERE id = ?', info.meta.last_row_id));
});

forms.get('/:id', requireAuth, async (c) => {
  const form = await first(c, 'SELECT * FROM forms WHERE id = ?', c.req.param('id'));
  if (!form) return c.json({ error: 'Not found' }, 404);
  const questions = await all(c, 'SELECT * FROM questions WHERE form_id = ? ORDER BY position, id', form.id);
  return c.json({
    ...form,
    questions: questions.map(q => ({
      ...q,
      options: JSON.parse(q.options_json || '[]'),
      validation: JSON.parse(q.validation_json || '{}'),
    })),
  });
});

forms.put('/:id', requireAuth, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    slug: z.string().optional(),
    status: z.enum(['draft', 'published', 'closed']).optional(),
    accent_color: z.string().optional(),
    settings: z.record(z.any()).optional(),
  }).safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const form = await first(c, 'SELECT * FROM forms WHERE id = ?', c.req.param('id'));
  if (!form) return c.json({ error: 'Not found' }, 404);

  const d = parsed.data;
  const fields = [];
  const vals = [];
  if (d.title !== undefined) { fields.push('title = ?'); vals.push(d.title); }
  if (d.description !== undefined) { fields.push('description = ?'); vals.push(d.description); }
  if (d.slug !== undefined) {
    let slug = slugify(d.slug);
    const exists = await first(c, 'SELECT id FROM forms WHERE slug = ? AND id != ?', slug, form.id);
    if (exists) slug = `${slug}-${Date.now().toString(36)}`;
    fields.push('slug = ?'); vals.push(slug);
  }
  if (d.status !== undefined) { fields.push('status = ?'); vals.push(d.status); }
  if (d.accent_color !== undefined) { fields.push('accent_color = ?'); vals.push(d.accent_color); }
  if (d.settings !== undefined) { fields.push('settings_json = ?'); vals.push(JSON.stringify(d.settings)); }
  fields.push("updated_at = datetime('now')");
  vals.push(form.id);

  await run(c, `UPDATE forms SET ${fields.join(', ')} WHERE id = ?`, ...vals);
  return c.json(await first(c, 'SELECT * FROM forms WHERE id = ?', form.id));
});

forms.delete('/:id', requireAuth, async (c) => {
  const form = await first(c, 'SELECT * FROM forms WHERE id = ?', c.req.param('id'));
  if (!form) return c.json({ error: 'Not found' }, 404);

  await deleteFormFiles(c, form.id);

  await c.env.DB.batch([
    stmt(c, 'DELETE FROM answers WHERE submission_id IN (SELECT id FROM submissions WHERE form_id = ?)', form.id),
    stmt(c, 'DELETE FROM files WHERE form_id = ?', form.id),
    stmt(c, 'DELETE FROM submissions WHERE form_id = ?', form.id),
    stmt(c, 'DELETE FROM questions WHERE form_id = ?', form.id),
    stmt(c, 'DELETE FROM form_views WHERE form_id = ?', form.id),
    stmt(c, 'DELETE FROM forms WHERE id = ?', form.id),
  ]);

  return c.json({ ok: true });
});

export default forms;
