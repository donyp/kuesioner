import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formsApi } from '../lib/api';
import { ArrowLeft, Trash2, Image as ImageIcon } from 'lucide-react';

export default function Responses() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const { data } = useQuery({ queryKey: ['responses', id, page], queryFn: () => formsApi.responses(id, page).then(r => r.data) });
  const purge = useMutation({
    mutationFn: () => formsApi.purgeResponses(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['responses', id] }),
  });

  if (!data) return <div className="text-muted">Memuat...</div>;

  const qTitle = (qid) => data.questions?.find(q => q.id === qid)?.title || qid;

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-6">
        <Link to="/" className="flex items-center gap-2 text-muted hover:text-text text-sm"><ArrowLeft size={16} /> Kembali</Link>
        <button onClick={() => { if (confirm('Hapus semua respons?')) purge.mutate(); }} className="btn btn-ghost text-sm text-red-400">
          <Trash2 size={14} /> Hapus Semua
        </button>
      </div>
      <h1 className="text-2xl font-semibold mb-1">Respons</h1>
      <p className="text-sm text-muted mb-6">Total {data.total} respons (anonim)</p>

      <div className="space-y-4">
        {data.items.map(s => (
          <div key={s.id} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-muted">{s.id.slice(0,8)}…</span>
              <span className="text-xs text-muted">{new Date(s.submitted_at).toLocaleString('id-ID')}</span>
            </div>
            <div className="space-y-2">
              {Object.entries(s.answers || {}).map(([qid, val]) => (
                <div key={qid} className="text-sm">
                  <div className="text-xs text-muted">{qTitle(Number(qid))}</div>
                  <div className="text-text">
                    {Array.isArray(val) ? val.join(', ') : (val === null || val === undefined || val === '' ? '-' : String(val))}
                  </div>
                </div>
              ))}
            </div>
            {s.files?.length > 0 && (
              <div className="mt-3 flex gap-2 flex-wrap">
                {s.files.map(f => (
                  <a key={f.id} href={`/api/files/${f.id}`} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-accent hover:underline">
                    <ImageIcon size={12} /> Lihat foto
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
        {data.items.length === 0 && <div className="card p-8 text-center text-muted">Belum ada respons.</div>}
      </div>

      {data.total > data.limit && (
        <div className="flex justify-center gap-2 mt-6">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn btn-ghost text-sm">Prev</button>
          <span className="text-sm text-muted self-center">Hal {page}</span>
          <button disabled={page * data.limit >= data.total} onClick={() => setPage(p => p + 1)} className="btn btn-ghost text-sm">Next</button>
        </div>
      )}
    </div>
  );
}