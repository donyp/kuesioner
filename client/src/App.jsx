import { Routes, Route, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { authApi } from './lib/api';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import FormBuilder from './pages/FormBuilder';
import FormStats from './pages/FormStats';
import Responses from './pages/Responses';
import Settings from './pages/Settings';
import PublicForm from './pages/PublicForm';

function RequireAuth({ children }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.me().then(r => r.data),
    retry: false,
  });
  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-muted">Memuat...</div>;
  if (isError || !data) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/f/:slug" element={<PublicForm />} />
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="forms/:id/edit" element={<FormBuilder />} />
        <Route path="forms/:id/stats" element={<FormStats />} />
        <Route path="forms/:id/responses" element={<Responses />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}