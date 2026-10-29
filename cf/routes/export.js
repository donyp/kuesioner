import { Hono } from 'hono';
import { all, first, stmt } from '../db.js';
import { requireAuth } from '../auth.js';
import { deleteKeys } from '../files.js';

const exp = new Hono();

exp.get('/forms/:id/export.csv', requireAuth, async (c) => {
  const formId = c.req.param('id');
  const form = await first(c, 'SELECT * FROM forms WHERE id = ?', formId);
  if (!form) return c.json({ error: 'Not found' }, 404);

  const questions = await all(c, 'SELECT * FROM questions WHERE form_id = ? ORDER BY position, id', formId);
  const submissions = await all(c, 'SELECT * FROM submissions WHERE form_id = ? ORDER BY submitted_at', formId);

  const header = ['submission_id', 'submitted_at', ...questions.filter(q => q.type !== 'section').map(q => q.title)];
  const rows = [header];

  for (const s of submissions) {
    const ans = await all(c, 'SELECT question_id, value_json FROM answers WHERE submission_id = ?', s.id);
    const amap = new Map(ans.map(a => [a.question_id, a.value_json]));
    const row = [s.id, s.submitted_at];
    for (const q of questions) {
      if (q.type === 'section') continue;
      let v = amap.has(q.id) ? JSON.parse(amap.get(q.id)) : '';
      if (Array.isArray(v)) v = v.join('; ');
      if (v === null || v === undefined) v = '';
      row.push(String(v).replace(/"/g, '""'));
    }
    rows.push(row);
  }

  const csv = rows.map(r => r.map(cell => `"${cell}"`).join(',')).join('\n');
  c.header('Content-Type', 'text/csv; charset=utf-8');
  c.header('Content-Disposition', `attachment; filename="form-${form.id}-responses.csv"`);
  return c.body(csv);
});

exp.get('/forms/:id/responses', requireAuth, async (c) => {
  const formId = c.req.param('id');
  const form = await first(c, 'SELECT id FROM forms WHERE id = ?', formId);
  if (!form) return c.json({ error: 'Not found' }, 404);

  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const limit = Math.min(100, Number(c.req.query('limit')) || 25);
  const offset = (page - 1) * limit;

  const submissions = await all(c, 'SELECT * FROM submissions WHERE form_id = ? ORDER BY submitted_at DESC LIMIT ? OFFSET ?', formId, limit, offset);
  const totalRow = await first(c, 'SELECT COUNT(*) AS c FROM submissions WHERE form_id = ?', formId);
  const questions = await all(c, 'SELECT * FROM questions WHERE form_id = ? ORDER BY position, id', formId);

  const items = [];
  for (const s of submissions) {
    const ans = await all(c, 'SELECT question_id, value_json FROM answers WHERE submission_id = ?', s.id);
    const answers = {};
    for (const a of ans) answers[a.question_id] = JSON.parse(a.value_json);
    const files = await all(c, 'SELECT id, question_id, path, mime, size FROM files WHERE submission_id = ?', s.id);
    items.push({ id: s.id, submitted_at: s.submitted_at, answers, files });
  }

  return c.json({
    items,
    total: totalRow.c,
    page,
    limit,
    questions: questions.map(q => ({ id: q.id, title: q.title, type: q.type })),
  });
});

exp.delete('/forms/:id/responses', requireAuth, async (c) => {
  const formId = c.req.param('id');
  const files = await all(c, 'SELECT path FROM files WHERE form_id = ?', formId);
  await deleteKeys(c, files.map(f => f.path));

  await c.env.DB.batch([
    stmt(c, 'DELETE FROM answers WHERE submission_id IN (SELECT id FROM submissions WHERE form_id = ?)', formId),
    stmt(c, 'DELETE FROM files WHERE form_id = ?', formId),
    stmt(c, 'DELETE FROM submissions WHERE form_id = ?', formId),
  ]);

  return c.json({ ok: true });
});

export default exp;
