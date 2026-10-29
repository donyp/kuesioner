import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { publicApi } from '../lib/api';
import { CheckCircle2, Upload, AlertCircle } from 'lucide-react';

let tsPromise = null;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (tsPromise) return tsPromise;
  tsPromise = new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true; s.defer = true;
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
  return tsPromise;
}

export default function PublicForm() {
  const { slug } = useParams();
  const { data: form, isLoading, isError } = useQuery({
    queryKey: ['publicForm', slug],
    queryFn: () => publicApi.getForm(slug).then(r => r.data),
  });
  const { data: settings } = useQuery({
    queryKey: ['publicSettings'],
    queryFn: () => publicApi.getSettings().then(r => r.data),
  });
  const [answers, setAnswers] = useState({});
  const [file, setFile] = useState(null);
  const [fileQid, setFileQid] = useState(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const tsRef = useRef(null);

  useEffect(() => {
    if (!settings?.turnstile?.enabled || !settings.turnstile.siteKey) return;
    let cancelled = false;
    const render = () => {
      if (cancelled || !window.turnstile || !tsRef.current) return;
      tsRef.current.innerHTML = '';
      window.turnstile.render(tsRef.current, {
        sitekey: settings.turnstile.siteKey,
        theme: 'dark',
        callback: (token) => setTurnstileToken(token),
        'expired-callback': () => setTurnstileToken(''),
      });
    };
    loadTurnstile().then(render);
    return () => { cancelled = true; };
  }, [settings]);

  const submit = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      const payload = { ...answers, __hp: honeypot };
      fd.append('answers', JSON.stringify(payload));
      if (file) {
        fd.append('file', file);
        fd.append('fileQuestionId', String(fileQid));
      }
      if (turnstileToken) fd.append('turnstileToken', turnstileToken);
      return publicApi.submit(slug, fd);
    },
    onSuccess: () => setDone(true),
    onError: (e) => setError(e.response?.data?.error || 'Gagal mengirim'),
  });

  const setAns = (qid, val) => setAnswers(prev => ({ ...prev, [qid]: val }));

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-muted">Memuat form...</div>;
  if (isError || !form) return <div className="min-h-screen flex items-center justify-center text-muted">Form tidak tersedia</div>;

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card p-10 text-center max-w-md fade-in">
          <CheckCircle2 size={48} className="mx-auto text-green-400 mb-4" />
          <h1 className="text-2xl font-semibold mb-2">Terima kasih!</h1>
          <p className="text-muted">Jawaban Anda telah terkirim. Data pengisi tidak disimpan.</p>
        </div>
      </div>
    );
  }

  const accent = form.accent_color || '#7C5CFC';

  return (
    <div className="min-h-screen py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="card p-8 mb-6 fade-in" style={{ borderTop: `3px solid ${accent}` }}>
          <h1 className="text-2xl font-semibold">{form.title}</h1>
          {form.description && <p className="text-muted mt-2 text-sm">{form.description}</p>}
        </div>

        <form onSubmit={e => { e.preventDefault(); setError(''); submit.mutate(); }} className="space-y-4">
          {(form.questions || []).map(q => {
            if (q.type === 'section') {
              return (
                <div key={q.id} className="card p-5">
                  <h3 className="font-semibold">{q.title}</h3>
                  {q.description && <p className="text-sm text-muted mt-1">{q.description}</p>}
                </div>
              );
            }
            return (
              <div key={q.id} className="card p-5">
                <label className="block font-medium mb-1">
                  {q.title} {q.required && <span className="text-red-400">*</span>}
                </label>
                {q.description && <p className="text-xs text-muted mb-2">{q.description}</p>}

                {q.type === 'short_text' && (
                  <input className="input" value={answers[q.id] || ''} onChange={e => setAns(q.id, e.target.value)} required={q.required} />
                )}
                {q.type === 'long_text' && (
                  <textarea className="input" rows={4} value={answers[q.id] || ''} onChange={e => setAns(q.id, e.target.value)} required={q.required} />
                )}
                {q.type === 'multiple_choice' && (
                  <div className="space-y-2 mt-2">
                    {(q.options || []).map((o, i) => (
                      <label key={i} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" name={`q-${q.id}`} value={o} checked={answers[q.id] === o}
                          onChange={() => setAns(q.id, o)} required={q.required} />
                        {o}
                      </label>
                    ))}
                  </div>
                )}
                {q.type === 'checkbox' && (
                  <div className="space-y-2 mt-2">
                    {(q.options || []).map((o, i) => {
                      const cur = Array.isArray(answers[q.id]) ? answers[q.id] : [];
                      return (
                        <label key={i} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={cur.includes(o)}
                            onChange={e => {
                              const next = e.target.checked ? [...cur, o] : cur.filter(x => x !== o);
                              setAns(q.id, next);
                            }} />
                          {o}
                        </label>
                      );
                    })}
                  </div>
                )}
                {q.type === 'dropdown' && (
                  <select className="input mt-2" value={answers[q.id] || ''} onChange={e => setAns(q.id, e.target.value)} required={q.required}>
                    <option value="">-- pilih --</option>
                    {(q.options || []).map((o, i) => <option key={i} value={o}>{o}</option>)}
                  </select>
                )}
                {q.type === 'linear_scale' && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {Array.from({ length: (q.validation?.max ?? 5) - (q.validation?.min ?? 1) + 1 }, (_, i) => (q.validation?.min ?? 1) + i).map(n => (
                        <label key={n} className={`w-10 h-10 rounded-lg border flex items-center justify-center cursor-pointer text-sm transition ${answers[q.id] === n ? 'bg-accent border-accent text-white' : 'border-border hover:border-accent/50'}`}>
                          <input type="radio" name={`q-${q.id}`} value={n} className="hidden" checked={answers[q.id] === n} onChange={() => setAns(q.id, n)} required={q.required} />
                          {n}
                        </label>
                      ))}
                    </div>
                    <div className="flex justify-between text-xs text-muted mt-1">
                      <span>{q.validation?.labelMin}</span>
                      <span>{q.validation?.labelMax}</span>
                    </div>
                  </div>
                )}
                {q.type === 'file' && (
                  <div className="mt-2">
                    <label className="flex items-center gap-2 btn btn-ghost cursor-pointer w-fit">
                      <Upload size={14} /> {file && fileQid === q.id ? file.name : 'Pilih foto (max 5MB)'}
                      <input type="file" accept="image/*" className="hidden" onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) { setFile(f); setFileQid(q.id); }
                      }} />
                    </label>
                    {file && fileQid === q.id && (
                      <p className="text-xs text-muted mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* honeypot: hidden from humans, bots tend to fill it */}
          <input
            type="text"
            name="website"
            value={honeypot}
            onChange={e => setHoneypot(e.target.value)}
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />

          {settings?.turnstile?.enabled && settings.turnstile.siteKey && (
            <div ref={tsRef} className="flex justify-center" />
          )}

          {error && (
            <div className="card p-4 border-red-500/40 text-red-400 text-sm flex items-center gap-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div className="flex justify-end">
            <button type="submit" disabled={submit.isPending} className="btn btn-primary">
              {submit.isPending ? 'Mengirim...' : 'Kirim Jawaban'}
            </button>
          </div>
        </form>

        <p className="text-xs text-muted text-center mt-6">
          Privasi: data pengisi (nama, IP, dll) tidak disimpan. Hanya jawaban yang direkam.
        </p>
      </div>
    </div>
  );
}