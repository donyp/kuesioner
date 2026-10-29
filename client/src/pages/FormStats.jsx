import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formsApi } from '../lib/api';
import { ArrowLeft, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';

const COLORS = ['#7C5CFC','#3B82F6','#22C55E','#F59E0B','#EF4444','#06B6D4','#EC4899'];

export default function FormStats() {
  const { id } = useParams();
  const { data: form } = useQuery({ queryKey: ['form', id], queryFn: () => formsApi.get(id).then(r => r.data) });
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let es;
    let cancelled = false;
    formsApi.stats(id).then(r => { if (!cancelled) setStats(r.data); });
    try {
      es = new EventSource(`/api/forms/${id}/stats/stream`, { withCredentials: true });
      es.onmessage = (e) => {
        try { setStats(JSON.parse(e.data)); } catch {}
      };
      es.onerror = () => { /* fallback polling */ };
    } catch {}
    // fallback polling
    const poll = setInterval(() => {
      formsApi.stats(id).then(r => { if (!cancelled) setStats(r.data); }).catch(() => {});
    }, 8000);
    return () => { cancelled = true; if (es) es.close(); clearInterval(poll); };
  }, [id]);

  if (!stats) return <div className="text-muted">Memuat statistik...</div>;

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-6">
        <Link to="/" className="flex items-center gap-2 text-muted hover:text-text text-sm"><ArrowLeft size={16} /> Kembali</Link>
        <a href={formsApi.exportCsv(id)} className="btn btn-ghost text-sm"><Download size={14} /> Export CSV</a>
      </div>

      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-2xl font-semibold">{form?.title}</h1>
        <span className="flex items-center gap-1.5 text-xs text-green-400 border border-green-500/30 bg-green-500/10 rounded-full px-2 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Live
        </span>
      </div>
      <p className="text-sm text-muted mb-6">Statistik real-time (SSE)</p>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard label="Total Respons" value={stats.total} />
        <StatCard label="Hari Ini" value={stats.today} />
        <StatCard label="Completion" value={`${stats.completionRate}%`} />
        <StatCard label="Total Views" value={stats.views} />
        <StatCard label="Views Hari Ini" value={stats.viewsToday} />
      </div>

      <div className="card p-5 mb-6">
        <h3 className="font-semibold mb-3">Tren 14 Hari</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.series || []}>
              <CartesianGrid stroke="#232633" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#8A8FA3" fontSize={11} />
              <YAxis stroke="#8A8FA3" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#161922', border: '1px solid #232633', color: '#E6E8EE' }} />
              <Line type="monotone" dataKey="c" stroke="#7C5CFC" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-6">
        {(stats.perQuestion || []).map(q => {
          if (q.type === 'section') return null;
          return (
            <div key={q.id} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">{q.title}</h3>
                <span className="text-xs text-muted">{q.filled}/{stats.total} terisi</span>
              </div>

              {q.breakdown?.type === 'choice' && (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={q.breakdown.options.map(o => ({ name: o, value: q.breakdown.counts[o] || 0 }))}>
                      <XAxis dataKey="name" stroke="#8A8FA3" fontSize={11} />
                      <YAxis stroke="#8A8FA3" fontSize={11} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: '#161922', border: '1px solid #232633', color: '#E6E8EE' }} />
                      <Bar dataKey="value" fill="#7C5CFC" radius={[6,6,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {q.breakdown?.type === 'multi' && (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={q.breakdown.options.map(o => ({ name: o, value: q.breakdown.counts[o] || 0 }))}>
                      <XAxis dataKey="name" stroke="#8A8FA3" fontSize={11} />
                      <YAxis stroke="#8A8FA3" fontSize={11} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: '#161922', border: '1px solid #232633', color: '#E6E8EE' }} />
                      <Bar dataKey="value" fill="#3B82F6" radius={[6,6,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {q.breakdown?.type === 'scale' && (
                <div>
                  <div className="text-sm text-muted mb-2">Rata-rata: <span className="text-text font-mono">{q.breakdown.average !== null ? q.breakdown.average.toFixed(2) : '-'}</span></div>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={Object.entries(q.breakdown.counts).map(([k,v]) => ({ name: k, value: v }))}>
                        <XAxis dataKey="name" stroke="#8A8FA3" fontSize={11} />
                        <YAxis stroke="#8A8FA3" fontSize={11} allowDecimals={false} />
                        <Tooltip contentStyle={{ background: '#161922', border: '1px solid #232633', color: '#E6E8EE' }} />
                        <Bar dataKey="value" fill="#22C55E" radius={[6,6,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {q.breakdown?.type === 'text' && (
                <div className="text-sm text-muted">
                  {q.filled} jawaban teks. Contoh terakhir:
                  <ul className="mt-2 space-y-1">
                    {(q.breakdown.samples || []).map((s, i) => <li key={i} className="text-text text-xs bg-bg/60 border border-border rounded p-2">{String(s)}</li>)}
                  </ul>
                </div>
              )}

              {q.type === 'file' && (
                <div className="text-sm text-muted">{q.fileCount} file terupload</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-muted mb-1">{label}</div>
      <div key={value} className="text-2xl font-bold font-mono fade-in">{value ?? 0}</div>
    </div>
  );
}