import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../lib/api';
import { LayoutDashboard, Settings, LogOut, Plus } from 'lucide-react';

export default function Layout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => authApi.me().then(r => r.data) });
  const logout = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => { qc.clear(); navigate('/login'); },
  });

  const nav = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/settings', label: 'Pengaturan', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 border-r border-border bg-surface flex flex-col">
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-blue-500 flex items-center justify-center font-bold text-white">K</div>
            <div>
              <div className="font-semibold text-sm">Kuesioner</div>
              <div className="text-xs text-muted">Admin Panel</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map(n => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${isActive ? 'bg-accent/15 text-white border border-accent/30' : 'text-muted hover:text-text hover:bg-white/5'}`}>
              <n.icon size={16} /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-border">
          <div className="px-3 py-2 text-xs text-muted truncate">{me?.username}</div>
          <button onClick={() => logout.mutate()} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted hover:text-red-400 hover:bg-red-500/10 transition">
            <LogOut size={16} /> Keluar
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}