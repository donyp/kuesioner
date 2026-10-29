import { Hono } from 'hono';
import { all, first } from '../db.js';
import { requireAuth } from '../auth.js';
import { cleanupExpiredFiles } from '../files.js';

const stats = new Hono();

async function computeStats(c, formId) {
  const totalRow = await first(c, 'SELECT COUNT(*) AS c FROM submissions WHERE form_id = ?', formId);
  const today = new Date().toISOString().slice(0, 10);
  const todayRow = await first(c, "SELECT COUNT(*) AS c FROM submissions WHERE form_id = ? AND substr(submitted_at,1,10) = ?", formId, today);
  const viewsRow = await first(c, 'SELECT COALESCE(SUM(count),0) AS c FROM form_views WHERE form_id = ?', formId);
  const viewsTodayRow = await first(c, 'SELECT COALESCE(SUM(count),0) AS c FROM form_views WHERE form_id = ? AND date = ?', formId, today);

  const questions = await all(c, 'SELECT * FROM questions WHERE form_id = ? ORDER BY position, id', formId);
  const perQuestion = [];

  for (const q of questions) {
    const rows = await all(c, 'SELECT value_json FROM answers WHERE question_id = ?', q.id);
    const answers = rows.map(r => { try { return JSON.parse(r.value_json); } catch { return null; } });
    const totalAns = answers.length;
    const filled = answers.filter(v => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)).length;

    let breakdown = null;
    if (q.type === 'multiple_choice' || q.type === 'dropdown') {
      const opts = JSON.parse(q.options_json || '[]');
      const counts = Object.fromEntries(opts.map(o => [o, 0]));
      let other = 0;
      for (const v of answers) {
        if (v in counts) counts[v]++; else if (v !== null && v !== undefined && v !== '') other++;
      }
      breakdown = { type: 'choice', options: opts, counts, other };
    } else if (q.type === 'checkbox') {
      const opts = JSON.parse(q.options_json || '[]');
      const counts = Object.fromEntries(opts.map(o => [o, 0]));
      for (const v of answers) {
        if (Array.isArray(v)) for (const o of v) if (o in counts) counts[o]++;
      }
      breakdown = { type: 'multi', options: opts, counts };
    } else if (q.type === 'linear_scale') {
      const v = JSON.parse(q.validation_json || '{}');
      const min = v.min ?? 1;
      const max = v.max ?? 5;
      const counts = {};
      for (let i = min; i <= max; i++) counts[i] = 0;
      for (const a of answers) if (a !== null && a !== undefined && a in counts) counts[a]++;
      const nums = answers.filter(a => typeof a === 'number');
      const avg = nums.length ? nums.reduce((s, x) => s + x, 0) / nums.length : null;
      breakdown = { type: 'scale', min, max, counts, average: avg };
    } else if (q.type === 'short_text' || q.type === 'long_text') {
      breakdown = { type: 'text', filled, samples: answers.filter(v => v).slice(-5) };
    } else if (q.type === 'section') {
      breakdown = { type: 'section' };
    }

    const fileRow = await first(c, 'SELECT COUNT(*) AS c FROM files WHERE question_id = ?', q.id);

    perQuestion.push({
      id: q.id,
      title: q.title,
      type: q.type,
      position: q.position,
      total: totalAns,
      filled,
      fileCount: fileRow.c,
      breakdown,
    });
  }

  const series = await all(c, `
    SELECT substr(submitted_at,1,10) AS date, COUNT(*) AS c
    FROM submissions WHERE form_id = ? AND submitted_at >= date('now','-13 days')
    GROUP BY date ORDER BY date
  `, formId);

  const required = questions.filter(q => q.required && q.type !== 'section');
  let completionRate = 100;
  if (totalRow.c > 0 && required.length > 0) {
    const subRows = await all(c, 'SELECT id FROM submissions WHERE form_id = ?', formId);
    let complete = 0;
    for (const s of subRows) {
      const ans = await all(c, 'SELECT question_id, value_json FROM answers WHERE submission_id = ?', s.id);
      const amap = new Map(ans.map(a => [a.question_id, a.value_json]));
      let ok = true;
      for (const q of required) {
        const raw = amap.get(q.id);
        const v = raw === undefined ? null : JSON.parse(raw);
        if (v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) { ok = false; break; }
      }
      if (ok) complete++;
    }
    completionRate = Math.round((complete / totalRow.c) * 100);
  }

  return {
    formId,
    total: totalRow.c,
    today: todayRow.c,
    views: viewsRow.c,
    viewsToday: viewsTodayRow.c,
    completionRate,
    perQuestion,
    series,
    generatedAt: new Date().toISOString(),
  };
}

stats.get('/forms/:id/stats', requireAuth, async (c) => {
  const form = await first(c, 'SELECT id FROM forms WHERE id = ?', c.req.param('id'));
  if (!form) return c.json({ error: 'Not found' }, 404);
  try { c.executionCtx.waitUntil(cleanupExpiredFiles(c)); } catch {}
  return c.json(await computeStats(c, form.id));
});

export default stats;
