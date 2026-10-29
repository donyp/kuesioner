import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { formsApi } from '../lib/api';
import { Plus, FileText, Trash2, ExternalLink, BarChart3, Copy } from 'lucide-react';

export default function Dashboard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: forms, isLoading } = useQuery({ queryKey: ['forms'], queryFn: () => formsApi.list().then(r => r.data) });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');

  const create = useMutation({
    mutationFn: () => formsApi.create({ title }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['forms'] });
      setOpen(false); setTitle('');
      navigate(`/forms/${res.data.id}/edit`);
    },
  });
  const remove = useMutation({
    mutationFn: (id) => formsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forms'] }),
  });

  const copyLink = (slug) => {
    const url = `${window.location.origin}/f/${slug}`;
    navigator.clipboard.writeText(url);
  };

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted mt-1">Kelola form kuesioner Anda</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn btn-primary">
          <Plus size={16} /> Buat Form
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="card p-5 h-32 skeleton" />)}
        </div>
      ) : (forms || []).length === 0 ? (
        <div className="card p-12 text-center">
          <FileText size={40} className="mx-auto text-muted mb-3" />
          <p className="text-muted">Belum ada form. Buat yang pertama!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(forms || []).map(f => (
            <div key={f.id} className="card p-5 hover:border-accent/40 transition group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{f.title}</h3>
                  <p className="text-xs text-muted mt-1 truncate">/f/{f.slug}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full border ${f.status === 'published' ? 'border-green-500/40 text-green-400 bg-green-500/10' : f.status === 'closed' ? 'border-red-500/40 text-red-400 bg-red-500/10' : 'border-border text-muted'}`}>
                  {f.status}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted mb-4">
                <span>{f.question_count} pertanyaan</span>
                <span>{f.submission_count} respons</span>
              </div>
              <div className="flex items-center gap-2">
                <Link to={`/forms/${f.id}/edit`} className="btn btn-ghost text-xs flex-1">Edit</Link>
                <Link to={`/forms/${f.id}/stats`} className="btn btn-ghost text-xs"><BarChart3 size={14} /></Link>
                <Link to={`/forms/${f.id}/responses`} className="btn btn-ghost text-xs"><FileText size={14} /></Link>
                <button onClick={() => copyLink(f.slug)} className="btn btn-ghost text-xs"><Copy size={14} /></button>
                <a href={`/f/${f.slug}`} target="_blank" rel="noreferrer" className="btn btn-ghost text-xs"><ExternalLink size={14} /></a>
                <button onClick={() => { if (confirm('Hapus form ini?')) remove.mutate(f.id); }} className="btn btn-ghost text-xs text-red-400"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setOpen(false)}>
          <div className="card p-6 w-full max-w-md fade-in" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Buat Form Baru</h2>
            <input className="input mb-4" placeholder="Judul form" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setOpen(false)} className="btn btn-ghost">Batal</button>
              <button onClick={() => create.mutate()} disabled={!title.trim() || create.isPending} className="btn btn-primary">
                {create.isPending ? 'Membuat...' : 'Buat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}