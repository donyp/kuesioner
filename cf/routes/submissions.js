import { Hono } from 'hono';
import { all, first, stmt } from '../db.js';
import { getSetting } from '../settings.js';

const subs = new Hono();

async function verifyTurnstile(secret, token) {
  if (!secret) return true;
  if (!token) return false;
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    });
    const j = await r.json();
    return !!j.success;
  } catch { return false; }
}

subs.post('/f/:slug/submit', async (c) => {
  const form = await first(c, 'SELECT * FROM forms WHERE slug = ?', c.req.param('slug'));
  if (!form) return c.json({ error: 'Form not found' }, 404);
  if (form.status !== 'published') return c.json({ error: 'Form not available' }, 403);

  const questions = await all(c, 'SELECT * FROM questions WHERE form_id = ?', form.id);
  const maxBytes = (Number(c.env.MAX_UPLOAD_MB) || 5) * 1024 * 1024;

  let answers = {};
  let file = null;
  let fileQuestionId = null;
  let turnstileToken = '';

  try {
    const ct = c.req.header('content-type') || '';
    if (ct.includes('multipart/form-data')) {
      const body = await c.req.parseBody();
      answers = JSON.parse(body.answers || '{}');
      fileQuestionId = body.fileQuestionId ? Number(body.fileQuestionId) : null;
      turnstileToken = body.turnstileToken || '';
      file = body.file;
    } else {
      const body = await c.req.json();
      answers = body.answers || {};
      fileQuestionId = body.fileQuestionId || null;
      turnstileToken = body.turnstileToken || '';
    }
  } catch {
    return c.json({ error: 'Format data tidak valid' }, 400);
  }

  const turnstile = await getSetting(c, 'turnstile', { enabled: false });
  if (turnstile?.enabled) {
    const ok = await verifyTurnstile(c.env.TURNSTILE_SECRET_KEY, turnstileToken);
    if (!ok) return c.json({ error: 'Captcha gagal. Muat ulang halaman.' }, 400);
  }

  const hasFile = file && typeof file !== 'string';

  // required validation
  for (const q of questions) {
    if (!q.required || q.type === 'section') continue;
    const v = answers[q.id];
    const hasFileForQ = hasFile && q.id === fileQuestionId;
    if (q.type === 'checkbox') {
      if ((!Array.isArray(v) || v.length === 0) && !hasFileForQ) {
        return c.json({ error: `Wajib diisi: ${q.title}` }, 400);
      }
    } else if ((v === undefined || v === null || v === '') && !hasFileForQ) {
      return c.json({ error: `Wajib diisi: ${q.title}` }, 400);
    }
  }

  // honeypot
  if (answers.__hp) return c.json({ error: 'Spam detected' }, 400);

  // file validation
  if (hasFile) {
    if (file.size > maxBytes) {
      return c.json({ error: `File terlalu besar (max ${c.env.MAX_UPLOAD_MB || 5}MB)` }, 400);
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      return c.json({ error: 'Tipe file tidak didukung' }, 400);
    }
  }

  const submissionId = crypto.randomUUID();
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const statements = [
    stmt(c, 'INSERT INTO submissions (id, form_id, submitted_at) VALUES (?,?,?)', submissionId, form.id, now),
  ];

  for (const q of questions) {
    if (q.type === 'section') continue;
    let val = answers[q.id];
    if (hasFile && q.id === fileQuestionId) val = '[file]';
    statements.push(stmt(c, 'INSERT INTO answers (submission_id, question_id, value_json) VALUES (?,?,?)', submissionId, q.id, JSON.stringify(val ?? null)));
  }

  let fileRow = null;
  if (hasFile) {
    const fileId = crypto.randomUUID();
    const key = `uploads/${fileId}.webp`;
    const buf = await file.arrayBuffer();
    await c.env.BUCKET.put(key, buf, { httpMetadata: { contentType: file.type } });
    fileRow = { fileId, key, size: buf.byteLength };
    statements.push(stmt(c, `
      INSERT INTO files (id, submission_id, question_id, form_id, path, mime, size, created_at)
      VALUES (?,?,?,?,?,?,?,?)
    `, fileId, submissionId, fileQuestionId, form.id, key, file.type, buf.byteLength, now));
  }

  await c.env.DB.batch(statements);

  return c.json({ ok: true, submissionId, file: fileRow ? { id: fileRow.fileId } : null });
});

export default subs;
