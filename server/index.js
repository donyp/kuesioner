import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.resolve(__dirname, '..', '.env')); } catch {}

import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { getDb, resolvePath, PROJECT_ROOT } from './db/index.js';

const app = Fastify({ logger: true });

await app.register(fastifyCookie, { secret: process.env.JWT_SECRET });
await app.register(fastifyCors, {
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
});
await app.register(fastifyHelmet, { contentSecurityPolicy: false });
await app.register(fastifyMultipart, { limits: { fileSize: (Number(process.env.MAX_UPLOAD_MB) || 5) * 1024 * 1024, files: 1 } });

// ensure db open
getDb();

// routes
import authRoutes from './routes/auth.js';
import formRoutes from './routes/forms.js';
import questionRoutes from './routes/questions.js';
import publicRoutes from './routes/public.js';
import submissionRoutes from './routes/submissions.js';
import statsRoutes from './routes/stats.js';
import exportRoutes from './routes/export.js';
import settingsRoutes from './routes/settings.js';
import fileRoutes from './routes/files.js';

await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(formRoutes, { prefix: '/api/forms' });
await app.register(questionRoutes, { prefix: '/api/forms' });
await app.register(publicRoutes, { prefix: '/api' });
await app.register(submissionRoutes, { prefix: '/api' });
await app.register(statsRoutes, { prefix: '/api' });
await app.register(exportRoutes, { prefix: '/api' });
await app.register(settingsRoutes, { prefix: '/api/settings' });
await app.register(fileRoutes, { prefix: '/api' });

// static uploads
import fsSync from 'node:fs';
const uploadDir = resolvePath(process.env.UPLOAD_DIR || './storage/uploads');
fsSync.mkdirSync(uploadDir, { recursive: true });
app.register(fastifyStatic, { root: uploadDir, prefix: '/uploads/', decorateReply: false });

// serve client build in production
const clientDist = path.resolve(PROJECT_ROOT, 'client', 'dist');
import fs from 'node:fs';
if (fs.existsSync(clientDist)) {
  await app.register(fastifyStatic, { root: clientDist, prefix: '/' });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api') || req.url.startsWith('/uploads')) {
      reply.code(404).send({ error: 'Not found' });
    } else {
      reply.sendFile('index.html');
    }
  });
}

import { startCleanupJob } from './lib/cleanup.js';
startCleanupJob();

const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || '0.0.0.0';
try {
  await app.listen({ port, host });
  console.log(`Server running at http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}