import { Hono } from 'hono';
import { first } from '../db.js';
import { requireAuth } from '../auth.js';

const files = new Hono();

files.get('/files/:id', requireAuth, async (c) => {
  const row = await first(c, 'SELECT * FROM files WHERE id = ?', c.req.param('id'));
  if (!row) return c.json({ error: 'Not found' }, 404);

  const obj = await c.env.BUCKET.get(row.path);
  if (!obj) return c.json({ error: 'File not found' }, 404);

  return new Response(obj.body, {
    headers: {
      'Content-Type': row.mime || obj.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'private, max-age=3600',
      'Content-Disposition': `inline; filename="${row.id}.webp"`,
    },
  });
});

export default files;
