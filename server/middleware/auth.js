import jwt from 'jsonwebtoken';
import { getDb } from '../db/index.js';

export function requireAuth(req, reply, done) {
  try {
    const token = req.cookies?.token;
    if (!token) throw new Error('no token');
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const admin = getDb().prepare('SELECT id, username FROM admins WHERE id = ?').get(payload.id);
    if (!admin) throw new Error('admin not found');
    req.admin = admin;
    done();
  } catch (e) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
}

export function signToken(admin) {
  return jwt.sign({ id: admin.id, username: admin.username }, process.env.JWT_SECRET, { expiresIn: '7d' });
}