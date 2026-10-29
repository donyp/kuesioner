import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { settingsApi, authApi } from '../lib/api';
import { Save } from 'lucide-react';

export default function Settings() {
  const { data } = useQuery({ queryKey: ['settings'], queryFn: () => settingsApi.get().then(r => r.data) });
  const [siteName, setSiteName] = useState('');
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [siteKey, setSiteKey] = useState('');
  const [retention, setRetention] = useState(0);
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (data) {
      setSiteName(data.siteName || '');
      setTurnstileEnabled(!!data.turnstile?.enabled);
      setSiteKey(data.turnstile?.siteKey || '');
      setRetention(data.retentionDays || 0);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => settingsApi.update({ siteName, turnstile: { enabled: turnstileEnabled, siteKey }, retentionDays: retention }),
    onSuccess: () => setMsg('Tersimpan'),
  });
  const changePw = useMutation({
    mutationFn: () => authApi.changePassword(curPw, newPw),
    onSuccess: () => { setMsg('Password diubah'); setCurPw(''); setNewPw(''); },
    onError: (e) => setMsg(e.response?.data?.error || 'Gagal'),
  });

  return (
    <div className="fade-in max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">Pengaturan</h1>

      <div className="card p-6 mb-6 space-y-4">
        <h2 className="font-semibold">Umum</h2>
        <div>
          <label className="text-xs text-muted mb-1 block">Nama Site</label>
          <input className="input" value={siteName} onChange={e => setSiteName(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted mb-1 block">Retensi file (hari, 0 = hapus saat form dihapus)</label>
          <input type="number" className="input" value={retention} onChange={e => setRetention(Number(e.target.value))} />
        </div>
        <button onClick={() => save.mutate()} className="btn btn-primary"><Save size={14} /> Simpan</button>
      </div>

      <div className="card p-6 mb-6 space-y-4">
        <h2 className="font-semibold">Cloudflare Turnstile (opsional)</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={turnstileEnabled} onChange={e => setTurnstileEnabled(e.target.checked)} />
          Aktifkan
        </label>
        <div>
          <label className="text-xs text-muted mb-1 block">Site Key</label>
          <input className="input" value={siteKey} onChange={e => setSiteKey(e.target.value)} />
        </div>
        <button onClick={() => save.mutate()} className="btn btn-primary"><Save size={14} /> Simpan</button>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="font-semibold">Ganti Password Admin</h2>
        <div>
          <label className="text-xs text-muted mb-1 block">Password Saat Ini</label>
          <input type="password" className="input" value={curPw} onChange={e => setCurPw(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted mb-1 block">Password Baru</label>
          <input type="password" className="input" value={newPw} onChange={e => setNewPw(e.target.value)} />
        </div>
        <button onClick={() => changePw.mutate()} disabled={!curPw || !newPw} className="btn btn-primary">Ubah Password</button>
      </div>

      {msg && <div className="text-sm text-green-400 mt-4">{msg}</div>}
    </div>
  );
}