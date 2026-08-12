import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/', label: 'Panel General', icon: '📊', roles: null },
  { to: '/terceros', label: 'Terceros', icon: '🏢', roles: ['CONTABILIDAD', 'COMPRAS', 'COMERCIAL', 'CARTERA'] },
  { to: '/productos', label: 'Productos', icon: '📦', roles: ['COMPRAS', 'CONTABILIDAD', 'VENDEDOR', 'BODEGUERO'] },
  { to: '/compras', label: 'Órdenes de Compra', icon: '🛒', roles: ['COMPRAS'] },
  { to: '/cuarentena', label: 'Cuarentena / Calidad', icon: '🧪', roles: ['DIRECTOR_TECNICO', 'BODEGUERO'] },
  { to: '/cotizaciones', label: 'Cotizaciones', icon: '📝', roles: ['VENDEDOR'] },
  { to: '/pedidos', label: 'Pedidos y Crédito', icon: '💳', roles: ['VENDEDOR', 'CARTERA', 'GERENCIA', 'BODEGUERO'] },
  { to: '/picking', label: 'Picking y Despacho', icon: '🚚', roles: ['BODEGUERO'] },
  { to: '/facturas', label: 'Facturación', icon: '🧾', roles: ['CONTABILIDAD', 'GERENCIA'] },
  { to: '/auditoria', label: 'Auditoría', icon: '🔎', roles: ['GERENCIA'] },
  { to: '/usuarios', label: 'Usuarios y Roles', icon: '👤', roles: ['ADMIN'] },
];

export default function Layout({ children }) {
  const { user, logout, hasRole } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const visibleNav = NAV.filter((n) => !n.roles || hasRole(...n.roles));

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Topbar móvil */}
      <div className="md:hidden flex items-center justify-between bg-white border-b border-slate-200 px-4 py-2.5 sticky top-0 z-20">
        <button onClick={() => setOpen(!open)} className="text-xl text-brand-700" aria-label="Abrir menú">☰</button>
        <img src="/logo.png" alt="H&D Medical Insumos" className="h-8" />
        <span className="text-xs text-slate-500">{user?.role_nombre}</span>
      </div>

      {/* Sidebar */}
      <aside className={`bg-brand-900 text-brand-50 w-full md:w-64 md:min-h-screen md:sticky md:top-0 ${open ? 'block' : 'hidden'} md:block`}>
        <div className="hidden md:flex items-center px-5 py-6 border-b border-brand-800 bg-white">
          <img src="/logo.png" alt="H&D Medical Insumos" className="h-10" />
        </div>
        <div className="hidden md:block px-5 py-3 border-b border-brand-800 text-xs text-brand-200">
          Sistema de Gestión de Insumos
        </div>
        <nav className="px-2 py-3 space-y-1">
          {visibleNav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  isActive ? 'bg-brand-700 text-white' : 'text-brand-100 hover:bg-brand-800'
                }`
              }
            >
              <span>{n.icon}</span>
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 mt-4 border-t border-brand-800 text-xs text-brand-200">
          <div className="font-semibold text-brand-50">{user?.nombre_completo}</div>
          <div className="mb-3">{user?.role_nombre}</div>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="btn btn-secondary btn-sm w-full !bg-brand-800 !text-white !border-brand-700 hover:!bg-brand-700"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">{children}</main>
    </div>
  );
}
