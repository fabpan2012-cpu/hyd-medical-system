import { useEffect, useState } from 'react';
import { api } from '../api/client';
import EstadoBadge from '../components/EstadoBadge';

export default function Picking() {
  const [pedidos, setPedidos] = useState([]);
  const [detalle, setDetalle] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  function load() { api.get('/ventas/pedidos?estado=RESERVADO').then(setPedidos).catch((e) => setError(e.message)); }
  useEffect(load, []);

  async function verPicking(id) {
    setError('');
    try {
      const d = await api.get(`/despacho/picking/${id}`);
      setDetalle(d);
    } catch (err) { setError(err.message); }
  }

  async function confirmar(id) {
    setError(''); setOk('');
    try {
      const res = await api.post(`/despacho/picking/${id}/confirmar`);
      setOk(`Remisión ${res.numero} generada. Pedido despachado y listo para facturación.`);
      setDetalle(null);
      load();
    } catch (err) { setError(err.message); }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Picking y Despacho</h1>
      <p className="text-slate-500 text-sm mb-5">Lista de picking por ubicación de bodega y lote asignado (FEFO), confirmación y remisión de salida</p>

      {error && <div className="mb-4 text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</div>}
      {ok && <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{ok}</div>}

      <div className="card overflow-x-auto mb-6">
        <table className="data-table">
          <thead><tr><th>Número</th><th>Cliente</th><th>Total</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {pedidos.map((p) => (
              <tr key={p.id}>
                <td className="font-mono">{p.numero}</td>
                <td>{p.cliente_nombre}</td>
                <td>${Number(p.total).toLocaleString('es-CO')}</td>
                <td><EstadoBadge estado={p.estado} /></td>
                <td><button className="btn btn-primary btn-sm" onClick={() => verPicking(p.id)}>Generar Lista de Picking</button></td>
              </tr>
            ))}
            {pedidos.length === 0 && <tr><td colSpan={5} className="text-center text-slate-400 py-6">No hay pedidos reservados pendientes de despacho.</td></tr>}
          </tbody>
        </table>
      </div>

      {detalle && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-30 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-xl max-h-[90vh] overflow-y-auto p-5">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">Lista de Picking — {detalle.pedido.numero}</h2>
                <p className="text-sm text-slate-500">Guía de empaque: Ubicación, Producto, Cantidad y Lote (FEFO)</p>
              </div>
              <button onClick={() => setDetalle(null)} className="text-slate-400 hover:text-slate-700 text-xl">✕</button>
            </div>
            <table className="data-table mb-5">
              <thead><tr><th>Ubicación</th><th>Producto</th><th>Lote</th><th>Vence</th><th>Cant.</th></tr></thead>
              <tbody>
                {detalle.lista_picking.map((l) => (
                  <tr key={l.asignacion_id}>
                    <td className="font-mono">{l.ubicacion_bodega || '—'}</td>
                    <td>{l.producto_nombre}</td>
                    <td className="font-mono">{l.numero_lote}</td>
                    <td>{l.fecha_vencimiento}</td>
                    <td>{l.cantidad_asignada}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn btn-primary w-full" onClick={() => confirmar(detalle.pedido.id)}>
              Confirmar recolección física → Generar Remisión de Salida
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
