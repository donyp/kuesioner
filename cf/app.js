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

app.get('/api/health', (c) => c.json({ ok: true, runtime: 'cloudflare-pages' }));

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
