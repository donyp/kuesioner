import { Hono } from 'hono';
import { z } from 'zod';
import { all, first, run, stmt } from '../db.js';
import { requireAuth } from '../auth.js';

const questions = new Hono();
const VALID_TYPES = ['short_text', 'long_text', 'multiple_choice', 'checkbox', 'dropdown', 'linear_scale', 'section', 'file'];

questions.get('/:formId/questions', requireAuth, async (c) => {
  const form = await first(c, 'SELECT id FROM forms WHERE id = ?', c.req.param('formId'));
  if (!form) return c.json({ error: 'Form not found' }, 404);
  const rows = await all(c, 'SELECT * FROM questions WHERE form_id = ? ORDER BY position, id', form.id);
  return c.json(rows.map(q => ({
    ...q,
    options: JSON.parse(q.options_json || '[]'),
    validation: JSON.parse(q.validation_json || '{}'),
  })));
});

questions.post('/:formId/questions', requireAuth, async (c) => {
  const form = await first(c, 'SELECT id FROM forms WHERE id = ?', c.req.param('formId'));
  if (!form) return c.json({ error: 'Form not found' }, 404);

  const body = await c.req.json().catch(() => null);
  const parsed = z.object({
    type: z.enum(VALID_TYPES),
    title: z.string().min(1).max(500),
    description: z.string().max(2000).optional().default(''),
    required: z.boolean().optional().default(false),
    options: z.array(z.string()).optional().default([]),
    validation: z.record(z.any()).optional().default({}),
    position: z.number().int().optional(),
  }).safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const d = parsed.data;
  const maxRow = await first(c, 'SELECT COALESCE(MAX(position),0) AS m FROM questions WHERE form_id = ?', form.id);
  const pos = d.position ?? (maxRow.m + 1);

  const info = await run(c, `
    INSERT INTO questions (form_id, type, title, description, required, options_json, validation_json, position)
    VALUES (?,?,?,?,?,?,?,?)
  `, form.id, d.type, d.title, d.description, d.required ? 1 : 0, JSON.stringify(d.options), JSON.stringify(d.validation), pos);

  const q = await first(c, 'SELECT * FROM questions WHERE id = ?', info.meta.last_row_id);
  return c.json({ ...q, options: JSON.parse(q.options_json), validation: JSON.parse(q.validation_json) });
});

questions.put('/:formId/questions/:qid', requireAuth, async (c) => {
  const q = await first(c, 'SELECT * FROM questions WHERE id = ? AND form_id = ?', c.req.param('qid'), c.req.param('formId'));
  if (!q) return c.json({ error: 'Not found' }, 404);

  const body = await c.req.json().catch(() => null);
  const parsed = z.object({
    type: z.enum(VALID_TYPES).optional(),
    title: z.string().min(1).max(500).optional(),
    description: z.string().max(2000).optional(),
    required: z.boolean().optional(),
    options: z.array(z.string()).optional(),
    validation: z.record(z.any()).optional(),
    position: z.number().int().optional(),
  }).safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const d = parsed.data;
  const fields = [];
  const vals = [];
  if (d.type !== undefined) { fields.push('type = ?'); vals.push(d.type); }
  if (d.title !== undefined) { fields.push('title = ?'); vals.push(d.title); }
  if (d.description !== undefined) { fields.push('description = ?'); vals.push(d.description); }
  if (d.required !== undefined) { fields.push('required = ?'); vals.push(d.required ? 1 : 0); }
  if (d.options !== undefined) { fields.push('options_json = ?'); vals.push(JSON.stringify(d.options)); }
  if (d.validation !== undefined) { fields.push('validation_json = ?'); vals.push(JSON.stringify(d.validation)); }
  if (d.position !== undefined) { fields.push('position = ?'); vals.push(d.position); }
  vals.push(q.id);

  if (fields.length) await run(c, `UPDATE questions SET ${fields.join(', ')} WHERE id = ?`, ...vals);
  const updated = await first(c, 'SELECT * FROM questions WHERE id = ?', q.id);
  return c.json({ ...updated, options: JSON.parse(updated.options_json), validation: JSON.parse(updated.validation_json) });
});

questions.delete('/:formId/questions/:qid', requireAuth, async (c) => {
  const q = await first(c, 'SELECT * FROM questions WHERE id = ? AND form_id = ?', c.req.param('qid'), c.req.param('formId'));
  if (!q) return c.json({ error: 'Not found' }, 404);
  await run(c, 'DELETE FROM questions WHERE id = ?', q.id);
  return c.json({ ok: true });
});

questions.post('/:formId/questions/reorder', requireAuth, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({ order: z.array(z.number().int()) }).safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const formId = c.req.param('formId');
  await c.env.DB.batch(
    parsed.data.order.map((id, idx) => stmt(c, 'UPDATE questions SET position = ? WHERE id = ? AND form_id = ?', idx + 1, id, formId))
  );
  return c.json({ ok: true });
});

export default questions;
