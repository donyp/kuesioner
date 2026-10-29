import { getDb } from '../db/index.js';
import { getSetting } from '../lib/settings.js';

export default async function publicRoutes(app) {
  app.get('/public/settings', async () => {
    const t = getSetting('turnstile', { enabled: false, siteKey: '' });
    return {
      siteName: getSetting('siteName', 'Kuesioner'),
      turnstile: { enabled: !!t?.enabled, siteKey: t?.siteKey || '' },
    };
  });

  app.get('/f/:slug', async (req, reply) => {
    const form = getDb().prepare('SELECT * FROM forms WHERE slug = ?').get(req.params.slug);
    if (!form) return reply.code(404).send({ error: 'Form not found' });
    if (form.status !== 'published') return reply.code(403).send({ error: 'Form not available' });
    const questions = getDb().prepare('SELECT * FROM questions WHERE form_id = ? ORDER BY position, id').all(form.id);
    // increment view (aggregated daily)
    const today = new Date().toISOString().slice(0, 10);
    getDb().prepare(`
      INSERT INTO form_views (form_id, date, count) VALUES (?,?,1)
      ON CONFLICT(form_id, date) DO UPDATE SET count = count + 1
    `).run(form.id, today);
    return {
      id: form.id,
      title: form.title,
      description: form.description,
      slug: form.slug,
      accent_color: form.accent_color,
      settings: JSON.parse(form.settings_json || '{}'),
      questions: questions.map(q => ({
        id: q.id,
        type: q.type,
        title: q.title,
        description: q.description,
        required: !!q.required,
        options: JSON.parse(q.options_json || '[]'),
        validation: JSON.parse(q.validation_json || '{}'),
      })),
    };
  });
}