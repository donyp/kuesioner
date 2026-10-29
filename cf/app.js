import { Hono } from 'hono';
import auth from './routes/auth.js';
import forms from './routes/forms.js';
import questions from './routes/questions.js';
import pub from './routes/public.js';
import subs from './routes/submissions.js';
import stats from './routes/stats.js';
import exp from './routes/export.js';
import settings from './routes/settings.js';
import files from './routes/files.js';

const app = new Hono();

// Simple manual CORS handling
app.use('*', async (c, next) => {
  const origin = c.req.header('origin') || c.req.header('Origin') || '*';
  c.header('Access-Control-Allow-Origin', origin);
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  c.header('Access-Control-Allow-Credentials', 'true');
  
  if (c.req.method === 'OPTIONS') {
    return c.text('OK', 200);
  }
  
  await next();
});

app.get('/api/health', (c) => c.json({ ok: true, runtime: 'cloudflare-pages' }));

// Debug endpoint - check what's available in context
app.get('/api/debug/env', async (c) => {
  try {
    const keys = Object.keys(c.env || {});
    return c.json({
      env_keys: keys,
      has_db: !!c.env.DB,
      has_jwt: !!c.env.JWT_SECRET,
      env_type: typeof c.env,
    });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

app.route('/api/auth', auth);
app.route('/api/forms', forms);
app.route('/api/forms', questions);
app.route('/api', pub);
app.route('/api', subs);
app.route('/api', stats);
app.route('/api', exp);
app.route('/api/settings', settings);
app.route('/api', files);

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

export default app;
