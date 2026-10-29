import { z } from 'zod';
import { getDb, resolvePath } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import fs from 'node:fs';
import path from 'node:path';

function slugify(s) {
  return String(s).toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60) || 'form';
}

export default async function formRoutes(app) {
  app.get('/', { preHandler: requireAuth }, async () => {
    const rows = getDb().prepare(`
      SELECT f.*,
        (SELECT COUNT(*) FROM submissions s WHERE s.form_id = f.id) AS submission_count,
        (SELECT COUNT(*) FROM questions q WHERE q.form_id = f.id) AS question_count
      FROM forms f ORDER BY f.updated_at DESC
    `).all();
    return rows;
  });

  app.post('/', { preHandler: requireAuth }, async (req, reply) => {
    const schema = z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(2000).optional().default(''),
      slug: z.string().optional(),
      status: z.enum(['draft','published','closed']).optional().default('draft'),
      accent_color: z.string().optional().default('#7C5CFC'),
      settings: z.record(z.any()).optional().default({}),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;
    let slug = d.slug ? slugify(d.slug) : slugify(d.title);
    // ensure unique
    const exists = getDb().prepare('SELECT id FROM forms WHERE slug = ?').get(slug);
    if (exists) slug = slug + '-' + Date.now().toString(36);
    const info = getDb().prepare(`
      INSERT INTO forms (title, description, slug, status, accent_color, settings_json)
      VALUES (?,?,?,?,?,?)
    `).run(d.title, d.description, slug, d.status, d.accent_color, JSON.stringify(d.settings));
    const form = getDb().prepare('SELECT * FROM forms WHERE id = ?').get(info.lastInsertRowid);
    return form;
  });

  app.get('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const form = getDb().prepare('SELECT * FROM forms WHERE id = ?').get(req.params.id);
    if (!form) return reply.code(404).send({ error: 'Not found' });
    const questions = getDb().prepare('SELECT * FROM questions WHERE form_id = ? ORDER BY position, id').all(form.id);
    return { ...form, questions: questions.map(q => ({
      ...q,
      options: JSON.parse(q.options_json || '[]'),
      validation: JSON.parse(q.validation_json || '{}'),
    })) };
  });

  app.put('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const schema = z.object({
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(2000).optional(),
      slug: z.string().optional(),
      status: z.enum(['draft','published','closed']).optional(),
      accent_color: z.string().optional(),
      settings: z.record(z.any()).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;
    const form = getDb().prepare('SELECT * FROM forms WHERE id = ?').get(req.params.id);
    if (!form) return reply.code(404).send({ error: 'Not found' });
    const fields = [];
    const vals = [];
    if (d.title !== undefined) { fields.push('title = ?'); vals.push(d.title); }
    if (d.description !== undefined) { fields.push('description = ?'); vals.push(d.description); }
    if (d.slug !== undefined) {
      let slug = slugify(d.slug);
      const exists = getDb().prepare('SELECT id FROM forms WHERE slug = ? AND id != ?').get(slug, form.id);
      if (exists) slug = slug + '-' + Date.now().toString(36);
      fields.push('slug = ?'); vals.push(slug);
    }
    if (d.status !== undefined) { fields.push('status = ?'); vals.push(d.status); }
    if (d.accent_color !== undefined) { fields.push('accent_color = ?'); vals.push(d.accent_color); }
    if (d.settings !== undefined) { fields.push('settings_json = ?'); vals.push(JSON.stringify(d.settings)); }
    fields.push("updated_at = datetime('now')");
    vals.push(form.id);
    getDb().prepare(`UPDATE forms SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
    return getDb().prepare('SELECT * FROM forms WHERE id = ?').get(form.id);
  });

  app.delete('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const form = getDb().prepare('SELECT * FROM forms WHERE id = ?').get(req.params.id);
    if (!form) return reply.code(404).send({ error: 'Not found' });
    // delete files from disk
    const files = getDb().prepare('SELECT path FROM files WHERE form_id = ?').all(form.id);
    for (const f of files) {
      try { fs.unlinkSync(resolvePath(f.path)); } catch {}
    }
    getDb().prepare('DELETE FROM forms WHERE id = ?').run(form.id);
    return { ok: true };
  });
}