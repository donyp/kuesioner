import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../lib/api';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => authApi.login(username, password),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['me'] }); navigate('/'); },
    onError: (e) => setError(e.response?.data?.error || 'Login gagal'),
  });

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm card p-8 fade-in">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-blue-500 flex items-center justify-center font-bold text-white text-lg">K</div>
          <div>
            <h1 className="text-xl font-semibold">Masuk Admin</h1>
            <p className="text-xs text-muted">Kuesioner Dashboard</p>
          </div>
        </div>
        <form onSubmit={e => { e.preventDefault(); setError(''); m.mutate(); }} className="space-y-4">
          <div>
            <label className="text-xs text-muted mb-1 block">Username</label>
            <input className="input" value={username} onChange={e => setUsername(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Password</label>
            <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          {error && <div className="text-sm text-red-400">{error}</div>}
          <button type="submit" className="btn btn-primary w-full" disabled={m.isPending}>
            {m.isPending ? 'Memproses...' : 'Masuk'}
          </button>
        </form>
        <p className="text-xs text-muted mt-6 text-center">Default: admin / admin123</p>
      </div>
    </div>
  );
}