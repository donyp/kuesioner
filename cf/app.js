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

// Bulletproof CORS middleware
app.use('*', async (c, next) => {
  try {
    const origin = (c.req.header('origin') || c.req.header('Origin') || c.req.header('ORIGIN') || '').toString();
    
    // Set CORS headers
    if (origin) {
      c.header('Access-Control-Allow-Origin', origin);
    } else {
      c.header('Access-Control-Allow-Origin', '*');
    }
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Access-Control-Max-Age', '86400');
    
    // Handle OPTIONS request
    if (c.req.method === 'OPTIONS') {
      return c.text('OK', 200);
    }
    
    await next();
  } catch (e) {
    console.error('[CORS_MIDDLEWARE] Error:', e?.message);
    return c.json({ error: 'Middleware error: ' + (e?.message || 'unknown') }, 500);
  }
});

app.get('/api/health', (c) => c.json({ ok: true, runtime: 'cloudflare-pages' }));

// Minimal test login without any dependencies
app.post('/api/test-login', async (c) => {
  try {
    console.log('[TEST] Starting test login');
    console.log('[TEST] c.env:', typeof c.env);
    console.log('[TEST] c.env.DB:', typeof c.env?.DB);
    console.log('[TEST] c.env.JWT_SECRET:', typeof c.env?.JWT_SECRET);
    
    return c.json({ 
      test: 'ok',
      hasDB: !!c.env?.DB,
      hasJWT: !!c.env?.JWT_SECRET,
      envKeys: Object.keys(c.env || {})
    });
  } catch (err) {
    console.error('[TEST] Error:', err);
    return c.json({ error: err.message, stack: err.stack }, 500);
  }
});

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
  console.error('[ERROR] Unhandled exception:');
  console.error('[ERROR] Message:', err?.message);
  console.error('[ERROR] Stack:', err?.stack);
  console.error('[ERROR] Full error:', JSON.stringify(err, null, 2));
  console.error('[ERROR] Type:', typeof err);
  
  return c.json({ 
    error: 'Internal Server Error',
    details: err?.message || 'Unknown error',
    type: err?.constructor?.name || 'Unknown'
  }, 500);
});

export default app;
