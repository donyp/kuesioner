import { z } from 'zod';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const VALID_TYPES = ['short_text','long_text','multiple_choice','checkbox','dropdown','linear_scale','section','file'];

export default async function questionRoutes(app) {
  // list
  app.get('/:formId/questions', { preHandler: requireAuth }, async (req, reply) => {
    const form = getDb().prepare('SELECT id FROM forms WHERE id = ?').get(req.params.formId);
    if (!form) return reply.code(404).send({ error: 'Form not found' });
    const rows = getDb().prepare('SELECT * FROM questions WHERE form_id = ? ORDER BY position, id').all(form.id);
    return rows.map(q => ({ ...q, options: JSON.parse(q.options_json || '[]'), validation: JSON.parse(q.validation_json || '{}') }));
  });

  // create
  app.post('/:formId/questions', { preHandler: requireAuth }, async (req, reply) => {
    const form = getDb().prepare('SELECT id FROM forms WHERE id = ?').get(req.params.formId);
    if (!form) return reply.code(404).send({ error: 'Form not found' });
    const schema = z.object({
      type: z.enum(VALID_TYPES),
      title: z.string().min(1).max(500),
      description: z.string().max(2000).optional().default(''),
      required: z.boolean().optional().default(false),
      options: z.array(z.string()).optional().default([]),
      validation: z.record(z.any()).optional().default({}),
      position: z.number().int().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;
    const maxPos = getDb().prepare('SELECT COALESCE(MAX(position),0) AS m FROM questions WHERE form_id = ?').get(form.id).m;
    const pos = d.position ?? (maxPos + 1);
    const info = getDb().prepare(`
      INSERT INTO questions (form_id, type, title, description, required, options_json, validation_json, position)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(form.id, d.type, d.title, d.description, d.required ? 1 : 0, JSON.stringify(d.options), JSON.stringify(d.validation), pos);
    const q = getDb().prepare('SELECT * FROM questions WHERE id = ?').get(info.lastInsertRowid);
    return { ...q, options: JSON.parse(q.options_json), validation: JSON.parse(q.validation_json) };
  });

  // update
  app.put('/:formId/questions/:qid', { preHandler: requireAuth }, async (req, reply) => {
    const q = getDb().prepare('SELECT * FROM questions WHERE id = ? AND form_id = ?').get(req.params.qid, req.params.formId);
    if (!q) return reply.code(404).send({ error: 'Not found' });
    const schema = z.object({
      type: z.enum(VALID_TYPES).optional(),
      title: z.string().min(1).max(500).optional(),
      description: z.string().max(2000).optional(),
      required: z.boolean().optional(),
      options: z.array(z.string()).optional(),
      validation: z.record(z.any()).optional(),
      position: z.number().int().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const d = parsed.data;
    const fields = []; const vals = [];
    if (d.type !== undefined) { fields.push('type = ?'); vals.push(d.type); }
    if (d.title !== undefined) { fields.push('title = ?'); vals.push(d.title); }
    if (d.description !== undefined) { fields.push('description = ?'); vals.push(d.description); }
    if (d.required !== undefined) { fields.push('required = ?'); vals.push(d.required ? 1 : 0); }
    if (d.options !== undefined) { fields.push('options_json = ?'); vals.push(JSON.stringify(d.options)); }
    if (d.validation !== undefined) { fields.push('validation_json = ?'); vals.push(JSON.stringify(d.validation)); }
    if (d.position !== undefined) { fields.push('position = ?'); vals.push(d.position); }
    vals.push(q.id);
    if (fields.length) getDb().prepare(`UPDATE questions SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
    const updated = getDb().prepare('SELECT * FROM questions WHERE id = ?').get(q.id);
    return { ...updated, options: JSON.parse(updated.options_json), validation: JSON.parse(updated.validation_json) };
  });

  // delete
  app.delete('/:formId/questions/:qid', { preHandler: requireAuth }, async (req, reply) => {
    const q = getDb().prepare('SELECT * FROM questions WHERE id = ? AND form_id = ?').get(req.params.qid, req.params.formId);
    if (!q) return reply.code(404).send({ error: 'Not found' });
    getDb().prepare('DELETE FROM questions WHERE id = ?').run(q.id);
    return { ok: true };
  });

  // reorder bulk
  app.post('/:formId/questions/reorder', { preHandler: requireAuth }, async (req, reply) => {
    const schema = z.object({ order: z.array(z.number().int()) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const stmt = getDb().prepare('UPDATE questions SET position = ? WHERE id = ? AND form_id = ?');
    parsed.data.order.forEach((id, idx) => stmt.run(idx + 1, id, req.params.formId));
    return { ok: true };
  });
}