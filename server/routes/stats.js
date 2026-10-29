import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { bus } from '../lib/events.js';

function computeStats(formId) {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) AS c FROM submissions WHERE form_id = ?').get(formId).c;
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = db.prepare("SELECT COUNT(*) AS c FROM submissions WHERE form_id = ? AND substr(submitted_at,1,10) = ?").get(formId, today).c;
  const views = db.prepare('SELECT COALESCE(SUM(count),0) AS c FROM form_views WHERE form_id = ?').get(formId).c;
  const viewsToday = db.prepare('SELECT COALESCE(SUM(count),0) AS c FROM form_views WHERE form_id = ? AND date = ?').get(formId, today).c;

  const questions = db.prepare('SELECT * FROM questions WHERE form_id = ? ORDER BY position, id').all(formId);
  const perQuestion = questions.map(q => {
    const answers = db.prepare('SELECT value_json FROM answers WHERE question_id = ?').all(q.id)
      .map(r => { try { return JSON.parse(r.value_json); } catch { return null; } });
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
      const avg = nums.length ? (nums.reduce((s,x)=>s+x,0)/nums.length) : null;
      breakdown = { type: 'scale', min, max, counts, average: avg };
    } else if (q.type === 'short_text' || q.type === 'long_text') {
      breakdown = { type: 'text', filled, samples: answers.filter(v=>v).slice(-5) };
    } else if (q.type === 'section') {
      breakdown = { type: 'section' };
    }

    // file count for this question
    const fileCount = getDb().prepare('SELECT COUNT(*) AS c FROM files WHERE question_id = ?').get(q.id).c;

    return {
      id: q.id,
      title: q.title,
      type: q.type,
      position: q.position,
      total: totalAns,
      filled,
      fileCount,
      breakdown,
    };
  });

  // time series (last 14 days)
  const series = db.prepare(`
    SELECT substr(submitted_at,1,10) AS date, COUNT(*) AS c
    FROM submissions WHERE form_id = ? AND submitted_at >= date('now','-13 days')
    GROUP BY date ORDER BY date
  `).all(formId);

  const completionRate = total > 0 && questions.filter(q=>q.required && q.type!=='section').length > 0
    ? Math.round((filledSubmissions(formId, questions) / total) * 100) : 100;

  return {
    formId,
    total,
    today: todayCount,
    views,
    viewsToday,
    completionRate,
    perQuestion,
    series,
    generatedAt: new Date().toISOString(),
  };
}

function filledSubmissions(formId, questions) {
  // count submissions where all required answered
  const required = questions.filter(q => q.required && q.type !== 'section');
  if (required.length === 0) return 0;
  const subs = getDb().prepare('SELECT id FROM submissions WHERE form_id = ?').all(formId).map(r=>r.id);
  let count = 0;
  for (const sid of subs) {
    const ans = getDb().prepare('SELECT question_id, value_json FROM answers WHERE submission_id = ?').all(sid);
    const amap = new Map(ans.map(a => [a.question_id, a.value_json]));
    let ok = true;
    for (const q of required) {
      const v = amap.has(q.id) ? JSON.parse(amap.get(q.id)) : null;
      if (v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) { ok = false; break; }
    }
    if (ok) count++;
  }
  return count;
}

export default async function statsRoutes(app) {
  app.get('/forms/:id/stats', { preHandler: requireAuth }, async (req, reply) => {
    const form = getDb().prepare('SELECT id FROM forms WHERE id = ?').get(req.params.id);
    if (!form) return reply.code(404).send({ error: 'Not found' });
    return computeStats(form.id);
  });

  // SSE stream
  app.get('/forms/:id/stats/stream', { preHandler: requireAuth }, async (req, reply) => {
    const formId = Number(req.params.id);
    const form = getDb().prepare('SELECT id FROM forms WHERE id = ?').get(formId);
    if (!form) return reply.code(404).send({ error: 'Not found' });

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': process.env.CLIENT_ORIGIN || 'http://localhost:5173',
      'Access-Control-Allow-Credentials': 'true',
    });

    const send = (data) => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    send(computeStats(formId));

    const onSubmission = (fid) => {
      if (fid === formId) {
        try { send(computeStats(formId)); } catch {}
      }
    };
    bus.on('submission', onSubmission);

    const hb = setInterval(() => {
      try { reply.raw.write(': heartbeat\n\n'); } catch {}
    }, 15000);

    req.raw.on('close', () => {
      bus.off('submission', onSubmission);
      clearInterval(hb);
    });
  });
}