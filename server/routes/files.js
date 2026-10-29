import fs from 'node:fs';
import { getDb, resolvePath } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

export default async function fileRoutes(app) {
  app.get('/files/:id', { preHandler: requireAuth }, async (req, reply) => {
    const row = getDb().prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
    if (!row) return reply.code(404).send({ error: 'Not found' });
    const filePath = resolvePath(row.path);
    if (!fs.existsSync(filePath)) return reply.code(404).send({ error: 'File not found' });
    reply.header('Content-Type', row.mime || 'application/octet-stream');
    reply.header('Cache-Control', 'private, max-age=3600');
    return reply.send(fs.createReadStream(filePath));
  });
}