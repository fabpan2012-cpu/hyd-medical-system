import { useEffect, useState } from 'react';
import { api } from '../api/client';
import EstadoBadge from '../components/EstadoBadge';
import { useAuth } from '../context/AuthContext';

export default function Pedidos() {
  const { hasRole } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [selected, setSelected] = useState(null);

  function load() { api.get('/ventas/pedidos').then(setPedidos).catch((e) => setError(e.message)); }
  useEffect(load, []);

  async function verDetalle(id) {
    const d = await api.get(`/ventas/pedidos/${id}`);
    setSelected(d);
  }

  async function evaluarCredito(id) {
    setError(''); setOk('');
    try {
      const res = await api.post(`/ventas/pedidos/${id}/evaluar-credito`);
      setOk(`Resultado evaluación: ${res.estado}`);
      load(); if (selected?.id === id) verDetalle(id);
    } catch (err) { setError(err.message); }
  }

  async function autorizarGerencia(id) {
    setError(''); setOk('');
    try {
      await api.post(`/ventas/pedidos/${id}/autorizar-gerencia`);
      setOk('Bloqueo de crédito superado con clave de gerencia. Pedido aprobado.');
      load(); if (selected?.id === id) verDetalle(id);
    } catch (err) { setError(err.message); }
  }

  async function asignarFefo(id) {
    setError(''); setOk('');
    try {
      const res = await api.post(`/ventas/pedidos/${id}/asignar-fefo`);
      setOk('Inventario asignado por FEFO y reservado.');
      load(); if (selected?.id === id) verDetalle(id);
    } catch (err) { setError(err.message); }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Pedidos y Crédito</h1>
      <p className="text-slate-500 text-sm mb-5">Evaluación de crédito, autorización de gerencia y reserva FEFO de inventario</p>

      {error && <div className="mb-4 text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</div>}
      {ok && <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{ok}</div>}

      <div className="card overflow-x-auto mb-6">
        <table className="data-table">
          <thead><tr><th>Número</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            {pedidos.map((p) => (
              <tr key={p.id}>
                <td className="font-mono">{p.numero}</td>
                <td>{p.cliente_nombre}</td>
                <td>${Number(p.total).toLocaleString('es-CO')}</td>
                <td><EstadoBadge estado={p.estado} /></td>
                <td className="space-x-2">
                  <button className="btn btn-secondary btn-sm" onClick={() => verDetalle(p.id)}>Ver</button>
                  {p.estado === 'PENDIENTE_CREDITO' && hasRole('VENDEDOR', 'CARTERA') && (
                    <button className="btn btn-primary btn-sm" onClick={() => evaluarCredito(p.id)}>Evaluar crédito</button>
                  )}
                  {p.estado === 'BLOQUEADO_CREDITO' && hasRole('GERENCIA') && (
                    <button className="btn btn-danger btn-sm" onClick={() => autorizarGerencia(p.id)}>Clave de Gerencia</button>
                  )}
                  {p.estado === 'APROBADO' && hasRole('VENDEDOR', 'BODEGUERO') && (
                    <button className="btn btn-primary btn-sm" onClick={() => asignarFefo(p.id)}>Asignar FEFO</button>
                  )}
                </td>
              </tr>
            ))}
            {pedidos.length === 0 && <tr><td colSpan={5} className="text-center text-slate-400 py-6">Sin pedidos registrados.</td></tr>}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-30 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-xl max-h-[90vh] overflow-y-auto p-5">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">{selected.numero}</h2>
                <p className="text-sm text-slate-500">{selected.cliente_nombre} — <EstadoBadge estado={selected.estado} /></p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700 text-xl">✕</button>
            </div>
            <table className="data-table">
              <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Lotes asignados (FEFO)</th></tr></thead>
              <tbody>
                {selected.items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.producto_nombre}</td>
                    <td>{it.cantidad}</td>
                    <td>${Number(it.precio_venta_unitario).toLocaleString('es-CO')}</td>
                    <td>
                      {it.asignaciones?.length
                        ? it.asignaciones.map((a) => <div key={a.id} className="text-xs font-mono">{a.numero_lote} × {a.cantidad_asignada} ({a.fecha_vencimiento})</div>)
                        : <span className="text-slate-400 text-xs">Sin asignar</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-right mt-4 font-bold">Total: ${Number(selected.total).toLocaleString('es-CO')}</div>
          </div>
        </div>
      )}
    </div>
  );
}
