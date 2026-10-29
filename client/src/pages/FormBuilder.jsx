import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formsApi } from '../lib/api';
import { ArrowLeft, Plus, Trash2, GripVertical, ChevronUp, ChevronDown, Save, Eye } from 'lucide-react';

const Q_TYPES = [
  { value: 'short_text', label: 'Teks Pendek' },
  { value: 'long_text', label: 'Teks Panjang' },
  { value: 'multiple_choice', label: 'Pilihan Ganda' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'linear_scale', label: 'Skala Linear' },
  { value: 'section', label: 'Bagian/Section' },
  { value: 'file', label: 'Upload Foto' },
];

export default function FormBuilder() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { data: form, isLoading } = useQuery({ queryKey: ['form', id], queryFn: () => formsApi.get(id).then(r => r.data) });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState('draft');
  const [accent, setAccent] = useState('#7C5CFC');
  const [showAdd, setShowAdd] = useState(false);
  const [newQ, setNewQ] = useState({ type: 'short_text', title: '', description: '', required: false, options: [], validation: {} });
  const [optionInput, setOptionInput] = useState('');

  useEffect(() => {
    if (form) {
      setTitle(form.title); setDescription(form.description || ''); setSlug(form.slug);
      setStatus(form.status); setAccent(form.accent_color || '#7C5CFC');
    }
  }, [form]);

  const saveForm = useMutation({
    mutationFn: () => formsApi.update(id, { title, description, slug, status, accent_color: accent }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['form', id] }),
  });

  const addQ = useMutation({
    mutationFn: () => formsApi.addQuestion(id, newQ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['form', id] });
      setShowAdd(false);
      setNewQ({ type: 'short_text', title: '', description: '', required: false, options: [], validation: {} });
      setOptionInput('');
    },
  });

  const delQ = useMutation({
    mutationFn: (qid) => formsApi.deleteQuestion(id, qid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['form', id] }),
  });

  const moveQ = (idx, dir) => {
    const qs = [...(form?.questions || [])];
    const target = idx + dir;
    if (target < 0 || target >= qs.length) return;
    [qs[idx], qs[target]] = [qs[target], qs[idx]];
    formsApi.reorder(id, qs.map(q => q.id))
      .then(() => qc.invalidateQueries({ queryKey: ['form', id] }))
      .catch(err => console.error('Error reordering:', err));
  };

  const updateQ = (qid, data) => {
    return formsApi.updateQuestion(id, qid, data)
      .then(() => qc.invalidateQueries({ queryKey: ['form', id] }))
      .catch(err => console.error('Error updating question:', err));
  };

  if (isLoading) return <div className="text-muted">Memuat...</div>;
  if (!form) return <div className="text-muted">Form tidak ditemukan</div>;

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-6">
        <Link to="/" className="flex items-center gap-2 text-muted hover:text-text text-sm"><ArrowLeft size={16} /> Kembali</Link>
        <div className="flex gap-2">
          <a href={`/f/${form.slug}`} target="_blank" rel="noreferrer" className="btn btn-ghost text-sm"><Eye size={14} /> Preview</a>
          <button onClick={() => saveForm.mutate()} className="btn btn-primary text-sm"><Save size={14} /> Simpan</button>
        </div>
      </div>

      <div className="card p-6 mb-6">
        <h2 className="font-semibold mb-4">Pengaturan Form</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted mb-1 block">Judul</label>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Slug (URL)</label>
            <input className="input" value={slug} onChange={e => setSlug(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Status</label>
            <select className="input" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Warna Aksen</label>
            <input type="color" className="input h-10" value={accent} onChange={e => setAccent(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-muted mb-1 block">Deskripsi</label>
            <textarea className="input" rows={3} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Pertanyaan ({form.questions?.length || 0})</h2>
        <button onClick={() => setShowAdd(true)} className="btn btn-primary text-sm"><Plus size={14} /> Tambah</button>
      </div>

      <div className="space-y-3">
        {(form.questions || []).map((q, idx) => (
          <div key={q.id} className="card p-4 flex gap-3 items-start">
            <div className="flex flex-col gap-1 pt-1">
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Move up clicked:', idx);
                  moveQ(idx, -1);
                }} 
                className="text-muted hover:text-text cursor-pointer"
                type="button"
              >
                <ChevronUp size={14} />
              </button>
              <GripVertical size={14} className="text-muted" />
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Move down clicked:', idx);
                  moveQ(idx, 1);
                }} 
                className="text-muted hover:text-text cursor-pointer"
                type="button"
              >
                <ChevronDown size={14} />
              </button>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs px-2 py-0.5 rounded bg-accent/15 text-accent border border-accent/30">{q.type}</span>
                {q.required ? <span className="text-xs text-red-400">wajib</span> : null}
              </div>
              <input
                className="input mb-2"
                defaultValue={q.title}
                onBlur={e => { 
                  if (e.target.value !== q.title) {
                    console.log('Updating question title:', q.id, e.target.value);
                    updateQ(q.id, { title: e.target.value });
                  }
                }}
              />
              {q.type !== 'section' && (
                <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={!!q.required} 
                    onChange={e => {
                      console.log('Toggling required:', q.id, e.target.checked);
                      updateQ(q.id, { required: e.target.checked });
                    }} 
                  />
                  Wajib diisi
                </label>
              )}
              {(q.type === 'multiple_choice' || q.type === 'checkbox' || q.type === 'dropdown') && (
                <div className="mt-2">
                  <div className="text-xs text-muted mb-1">Opsi (pisahkan enter):</div>
                  <textarea className="input text-xs" rows={3}
                    defaultValue={(q.options || []).join('\n')}
                    onBlur={e => {
                      const newOptions = e.target.value.split('\n').map(s=>s.trim()).filter(Boolean);
                      console.log('Updating options:', q.id, newOptions);
                      updateQ(q.id, { options: newOptions });
                    }} 
                  />
                </div>
              )}
              {q.type === 'linear_scale' && (
                <div className="mt-2 flex gap-2">
                  <input type="number" className="input text-xs w-20" placeholder="min" defaultValue={q.validation?.min ?? 1}
                    onBlur={e => {
                      console.log('Updating scale min:', q.id, e.target.value);
                      updateQ(q.id, { validation: { ...q.validation, min: Number(e.target.value) } });
                    }} 
                  />
                  <input type="number" className="input text-xs w-20" placeholder="max" defaultValue={q.validation?.max ?? 5}
                    onBlur={e => {
                      console.log('Updating scale max:', q.id, e.target.value);
                      updateQ(q.id, { validation: { ...q.validation, max: Number(e.target.value) } });
                    }} 
                  />
                  <input className="input text-xs flex-1" placeholder="label min" defaultValue={q.validation?.labelMin ?? ''}
                    onBlur={e => {
                      console.log('Updating scale labelMin:', q.id, e.target.value);
                      updateQ(q.id, { validation: { ...q.validation, labelMin: e.target.value } });
                    }} 
                  />
                  <input className="input text-xs flex-1" placeholder="label max" defaultValue={q.validation?.labelMax ?? ''}
                    onBlur={e => {
                      console.log('Updating scale labelMax:', q.id, e.target.value);
                      updateQ(q.id, { validation: { ...q.validation, labelMax: e.target.value } });
                    }} 
                  />
                </div>
              )}
            </div>
            <button 
              onClick={() => { 
                console.log('Delete button clicked for question:', q.id);
                if (confirm('Hapus pertanyaan?')) {
                  console.log('Deleting question:', q.id);
                  delQ.mutate(q.id);
                }
              }} 
              className="text-muted hover:text-red-400"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
          <div className="card p-6 w-full max-w-lg fade-in" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Tambah Pertanyaan</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted mb-1 block">Tipe</label>
                <select className="input" value={newQ.type} onChange={e => setNewQ({ ...newQ, type: e.target.value })}>
                  {Q_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">Judul</label>
                <input className="input" value={newQ.title} onChange={e => setNewQ({ ...newQ, title: e.target.value })} autoFocus />
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">Deskripsi (opsional)</label>
                <input className="input" value={newQ.description} onChange={e => setNewQ({ ...newQ, description: e.target.value })} />
              </div>
              {(newQ.type === 'multiple_choice' || newQ.type === 'checkbox' || newQ.type === 'dropdown') && (
                <div>
                  <label className="text-xs text-muted mb-1 block">Opsi (satu per baris)</label>
                  <textarea className="input text-sm" rows={4} value={optionInput} onChange={e => setOptionInput(e.target.value)}
                    placeholder={'Opsi 1\nOpsi 2\nOpsi 3'} />
                </div>
              )}
              {newQ.type === 'linear_scale' && (
                <div className="flex gap-2">
                  <input type="number" className="input text-xs w-20" placeholder="min" value={newQ.validation?.min ?? 1}
                    onChange={e => setNewQ({ ...newQ, validation: { ...newQ.validation, min: Number(e.target.value) } })} />
                  <input type="number" className="input text-xs w-20" placeholder="max" value={newQ.validation?.max ?? 5}
                    onChange={e => setNewQ({ ...newQ, validation: { ...newQ.validation, max: Number(e.target.value) } })} />
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={newQ.required} onChange={e => setNewQ({ ...newQ, required: e.target.checked })} />
                Wajib diisi
              </label>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => setShowAdd(false)} className="btn btn-ghost">Batal</button>
              <button onClick={() => {
                const opts = optionInput.split('\n').map(s => s.trim()).filter(Boolean);
                addQ.mutate({ ...newQ, options: opts });
              }} disabled={!newQ.title.trim() || addQ.isPending} className="btn btn-primary">
                {addQ.isPending ? 'Menambah...' : 'Tambah'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}