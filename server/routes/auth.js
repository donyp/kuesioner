import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { getDb } from '../db/index.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';

export default async function authRoutes(app) {
  app.post('/login', { preHandler: rateLimit({ max: 8, windowMs: 15 * 60_000 }) }, async (req, reply) => {
    const schema = z.object({ username: z.string().min(1), password: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid input' });
    const { username, password } = parsed.data;
    const admin = getDb().prepare('SELECT * FROM admins WHERE username = ?').get(username);
    if (!admin) return reply.code(401).send({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) return reply.code(401).send({ error: 'Invalid credentials' });
    const token = signToken(admin);
    reply.setCookie('token', token, {
      httpOnly: true, sameSite: 'lax', path: '/', maxAge: 7 * 24 * 3600,
      secure: process.env.NODE_ENV === 'production',
    });
    return { ok: true, username: admin.username };
  });

  app.post('/logout', async (req, reply) => {
    reply.clearCookie('token', { path: '/' });
    return { ok: true };
  });

  app.get('/me', { preHandler: requireAuth }, async (req) => {
    return { id: req.admin.id, username: req.admin.username };
  });

  app.post('/change-password', { preHandler: requireAuth }, async (req, reply) => {
    const schema = z.object({ current: z.string().min(1), next: z.string().min(6) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid input' });
    const admin = getDb().prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id);
    const ok = await bcrypt.compare(parsed.data.current, admin.password_hash);
    if (!ok) return reply.code(401).send({ error: 'Current password wrong' });
    const hash = await bcrypt.hash(parsed.data.next, 10);
    getDb().prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, req.admin.id);
    return { ok: true };
  });
}