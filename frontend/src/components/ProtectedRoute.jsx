import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from './Layout';

export default function ProtectedRoute({ children, roles }) {
  const { user, loading, hasRole } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !hasRole(...roles)) {
    return (
      <Layout>
        <div className="card p-8 text-center">
          <div className="text-3xl mb-2">🔒</div>
          <h2 className="font-bold text-lg text-slate-700">Acceso denegado</h2>
          <p className="text-slate-500 text-sm mt-1">Tu perfil ({user.role_nombre}) no tiene permisos para ver esta sección.</p>
        </div>
      </Layout>
    );
  }

  return <Layout>{children}</Layout>;
}
