import { Hono } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import { z } from 'zod';
import { first, run } from '../db.js';
import { hashPassword, verifyPassword, signToken, requireAuth } from '../auth.js';

const auth = new Hono();

function isHttps(c) {
  return new URL(c.req.url).protocol === 'https:';
}

auth.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({ username: z.string().min(1), password: z.string().min(1) }).safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid input' }, 400);

  const admin = await first(c, 'SELECT * FROM admins WHERE username = ?', parsed.data.username);
  if (!admin) return c.json({ error: 'Invalid credentials' }, 401);
  const ok = await verifyPassword(parsed.data.password, admin.password_hash);
  if (!ok) return c.json({ error: 'Invalid credentials' }, 401);

  const token = await signToken(c, admin);
  setCookie(c, 'token', token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 7 * 86400,
    secure: isHttps(c),
  });
  return c.json({ ok: true, username: admin.username });
});

auth.post('/logout', async (c) => {
  deleteCookie(c, 'token', { path: '/' });
  return c.json({ ok: true });
});

auth.get('/me', requireAuth, async (c) => {
  const admin = c.get('admin');
  return c.json({ id: admin.id, username: admin.username });
});

auth.post('/change-password', requireAuth, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({ current: z.string().min(1), next: z.string().min(6) }).safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid input' }, 400);

  const admin = await first(c, 'SELECT * FROM admins WHERE id = ?', c.get('admin').id);
  const ok = await verifyPassword(parsed.data.current, admin.password_hash);
  if (!ok) return c.json({ error: 'Current password wrong' }, 401);

  const hash = await hashPassword(parsed.data.next);
  await run(c, 'UPDATE admins SET password_hash = ? WHERE id = ?', hash, admin.id);
  return c.json({ ok: true });
});

export default auth;
