import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.resolve(__dirname, '..', '..', '.env')); } catch {}

import bcrypt from 'bcryptjs';
import { getDb } from './index.js';

const db = getDb();
const username = process.env.ADMIN_USERNAME || 'admin';
const password = process.env.ADMIN_PASSWORD || 'admin123';

const existing = db.prepare('SELECT id FROM admins WHERE username = ?').get(username);
if (existing) {
  console.log('Admin already exists:', username);
  process.exit(0);
}
const hash = await bcrypt.hash(password, 10);
db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run(username, hash);
console.log('Seeded admin:', username);
process.exit(0);