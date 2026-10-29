import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getDb, resolvePath } from '../db/index.js';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { rateLimit } from '../middleware/rateLimit.js';
import { getSetting } from '../lib/settings.js';

const MAX_BYTES = (Number(process.env.MAX_UPLOAD_MB) || 5) * 1024 * 1024;

async function verifyTurnstile(token) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
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

export default async function submissionRoutes(app) {
  app.post('/f/:slug/submit', { preHandler: rateLimit({ max: 10, windowMs: 60_000 }) }, async (req, reply) => {
    const form = getDb().prepare('SELECT * FROM forms WHERE slug = ?').get(req.params.slug);
    if (!form) return reply.code(404).send({ error: 'Form not found' });
    if (form.status !== 'published') return reply.code(403).send({ error: 'Form not available' });

    const questions = getDb().prepare('SELECT * FROM questions WHERE form_id = ?').all(form.id);

    let answers = {};
    let fileBuffer = null;
    let fileMime = null;
    let fileQuestionId = null;
    let turnstileToken = '';

    try {
      const ct = req.headers['content-type'] || '';
      if (ct.includes('multipart/form-data')) {
        const parts = req.parts();
        for await (const part of parts) {
          if (part.type === 'file') {
            if (part.fieldname === 'file') {
              fileBuffer = await part.toBuffer();
              fileMime = part.mimetype;
            }
          } else {
            if (part.fieldname === 'answers') answers = JSON.parse(part.value || '{}');
            if (part.fieldname === 'fileQuestionId') fileQuestionId = Number(part.value);
            if (part.fieldname === 'turnstileToken') turnstileToken = part.value;
          }
        }
      } else {
        const body = req.body || {};
        answers = body.answers || {};
        turnstileToken = body.turnstileToken || '';
        fileQuestionId = body.fileQuestionId || null;
      }
    } catch (e) {
      return reply.code(400).send({ error: 'Format data tidak valid' });
    }

    const turnstile = getSetting('turnstile', { enabled: false });
    if (turnstile?.enabled && !(await verifyTurnstile(turnstileToken))) {
      return reply.code(400).send({ error: 'Captcha gagal. Muat ulang halaman.' });
    }

    // validate required
    for (const q of questions) {
      if (!q.required) continue;
      if (q.type === 'section') continue;
      const v = answers[q.id];
      const hasFile = q.id === fileQuestionId && fileBuffer;
      if (q.type === 'checkbox') {
        if (!Array.isArray(v) || v.length === 0) {
          if (!hasFile) return reply.code(400).send({ error: `Required: ${q.title}` });
        }
      } else {
        if ((v === undefined || v === null || v === '') && !hasFile) {
          return reply.code(400).send({ error: `Required: ${q.title}` });
        }
      }
    }

    // honeypot
    if (answers.__hp) return reply.code(400).send({ error: 'Spam detected' });

    const submissionId = uuidv4();
    const db = getDb();
    db.prepare('INSERT INTO submissions (id, form_id) VALUES (?, ?)').run(submissionId, form.id);

    const insertAnswer = db.prepare('INSERT INTO answers (submission_id, question_id, value_json) VALUES (?,?,?)');
    for (const q of questions) {
      if (q.type === 'section') continue;
      let val = answers[q.id];
      if (q.id === fileQuestionId && fileBuffer) val = '[file]';
      insertAnswer.run(submissionId, q.id, JSON.stringify(val ?? null));
    }

    // handle file
    if (fileBuffer) {
      if (fileBuffer.length > MAX_BYTES) {
        // rollback submission
        db.prepare('DELETE FROM submissions WHERE id = ?').run(submissionId);
        return reply.code(400).send({ error: `File too large (max ${process.env.MAX_UPLOAD_MB}MB)` });
      }
      const allowed = ['image/jpeg','image/png','image/webp','image/gif'];
      if (!allowed.includes(fileMime)) {
        db.prepare('DELETE FROM submissions WHERE id = ?').run(submissionId);
        return reply.code(400).send({ error: 'Invalid file type' });
      }
      const uploadDir = resolvePath(process.env.UPLOAD_DIR || './storage/uploads');
      fs.mkdirSync(uploadDir, { recursive: true });
      const fileId = uuidv4();
      const outPath = path.join(uploadDir, fileId + '.webp');
      // store path relative to project root
      const rel = path.relative(resolvePath('.'), outPath).replace(/\\/g, '/');
      await sharp(fileBuffer).rotate().resize({ width: 1920, withoutEnlargement: true }).webp({ quality: 82 }).toFile(outPath);
      db.prepare('INSERT INTO files (id, submission_id, question_id, form_id, path, mime, size) VALUES (?,?,?,?,?,?,?)')
        .run(fileId, submissionId, fileQuestionId, form.id, rel, 'image/webp', fs.statSync(outPath).size);
    }

    const { emitSubmission } = await import('../lib/events.js');
    emitSubmission(form.id);

    return { ok: true, submissionId };
  });
}