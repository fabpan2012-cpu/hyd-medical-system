import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

function StatCard({ label, value, tone = 'slate' }) {
  const tones = {
    slate: 'bg-white text-slate-800',
    yellow: 'bg-amber-50 text-amber-800 border-amber-200',
    red: 'bg-rose-50 text-rose-800 border-rose-200',
    green: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    blue: 'bg-blue-50 text-blue-800 border-blue-200',
  };
  return (
    <div className={`card p-4 border ${tones[tone]}`}>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dashboard').then(setData).catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800">Bienvenido, {user?.nombre_completo?.split(' ')[0]}</h1>
      <p className="text-slate-500 mb-6">{user?.role_nombre} · Panel general de procesos</p>

      {error && <div className="text-rose-600">{error}</div>}
      {!data ? (
        <div className="text-slate-400">Cargando indicadores...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Terceros activos" value={data.terceros_activos} />
            <StatCard label="Lotes en cuarentena" value={data.lotes_en_cuarentena} tone="yellow" />
            <StatCard label="OC abiertas" value={data.ordenes_compra_abiertas} tone="blue" />
            <StatCard label="Pendientes de crédito" value={data.pedidos_pendientes_credito} tone="yellow" />
            <StatCard label="Bloqueados por crédito" value={data.pedidos_bloqueados_credito} tone="red" />
            <StatCard label="Reservados por despachar" value={data.pedidos_reservados_por_despachar} tone="blue" />
            <StatCard label="Facturas emitidas hoy" value={data.facturas_emitidas_hoy} tone="green" />
            <StatCard label="Ventas facturadas (mes)" value={`$${Number(data.ventas_facturadas_mes_actual).toLocaleString('es-CO')}`} tone="green" />
          </div>

          <div className="card p-5">
            <h2 className="font-semibold text-slate-700 mb-3">Lotes próximos a vencer (≤ 60 días)</h2>
            {data.lotes_proximos_vencer.length === 0 ? (
              <div className="text-sm text-slate-400">No hay lotes próximos a vencer.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr><th>Lote</th><th>Producto</th><th>Vence</th><th>Disponible</th></tr>
                  </thead>
                  <tbody>
                    {data.lotes_proximos_vencer.map((l, i) => (
                      <tr key={i}>
                        <td className="font-mono">{l.numero_lote}</td>
                        <td>{l.producto}</td>
                        <td>{l.fecha_vencimiento}</td>
                        <td>{l.cantidad_disponible}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
