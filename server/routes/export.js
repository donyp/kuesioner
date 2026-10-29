import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

export default async function exportRoutes(app) {
  app.get('/forms/:id/export.csv', { preHandler: requireAuth }, async (req, reply) => {
    const formId = Number(req.params.id);
    const form = getDb().prepare('SELECT * FROM forms WHERE id = ?').get(formId);
    if (!form) return reply.code(404).send({ error: 'Not found' });
    const questions = getDb().prepare('SELECT * FROM questions WHERE form_id = ? ORDER BY position, id').all(formId);
    const subs = getDb().prepare('SELECT * FROM submissions WHERE form_id = ? ORDER BY submitted_at').all(formId);

    const header = ['submission_id', 'submitted_at', ...questions.filter(q=>q.type!=='section').map(q => q.title)];
    const rows = [header];
    for (const s of subs) {
      const ans = getDb().prepare('SELECT question_id, value_json FROM answers WHERE submission_id = ?').all(s.id);
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
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="form-${form.id}-responses.csv"`);
    return csv;
  });

  app.get('/forms/:id/responses', { preHandler: requireAuth }, async (req, reply) => {
    const formId = Number(req.params.id);
    const form = getDb().prepare('SELECT id FROM forms WHERE id = ?').get(formId);
    if (!form) return reply.code(404).send({ error: 'Not found' });
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 25);
    const offset = (page - 1) * limit;
    const subs = getDb().prepare('SELECT * FROM submissions WHERE form_id = ? ORDER BY submitted_at DESC LIMIT ? OFFSET ?').all(formId, limit, offset);
    const total = getDb().prepare('SELECT COUNT(*) AS c FROM submissions WHERE form_id = ?').get(formId).c;
    const questions = getDb().prepare('SELECT * FROM questions WHERE form_id = ? ORDER BY position, id').all(formId);
    const items = subs.map(s => {
      const ans = getDb().prepare('SELECT question_id, value_json FROM answers WHERE submission_id = ?').all(s.id);
      const answers = {};
      for (const a of ans) answers[a.question_id] = JSON.parse(a.value_json);
      const files = getDb().prepare('SELECT id, question_id, path, mime, size FROM files WHERE submission_id = ?').all(s.id);
      return { id: s.id, submitted_at: s.submitted_at, answers, files };
    });
    return { items, total, page, limit, questions: questions.map(q=>({id:q.id,title:q.title,type:q.type})) };
  });

  app.delete('/forms/:id/responses', { preHandler: requireAuth }, async (req, reply) => {
    const formId = Number(req.params.id);
    const files = getDb().prepare('SELECT path FROM files WHERE form_id = ?').all(formId);
    for (const f of files) {
      try { const { unlinkSync } = await import('node:fs'); const { resolvePath } = await import('../db/index.js'); unlinkSync(resolvePath(f.path)); } catch {}
    }
    getDb().prepare('DELETE FROM submissions WHERE form_id = ?').run(formId);
    return { ok: true };
  });
}