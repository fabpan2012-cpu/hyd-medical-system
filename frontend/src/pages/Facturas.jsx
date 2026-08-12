import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Facturas() {
  const { hasRole } = useAuth();
  const [facturas, setFacturas] = useState([]);
  const [pedidosDespachados, setPedidosDespachados] = useState([]);
  const [detalle, setDetalle] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  function load() {
    api.get('/despacho/facturas').then(setFacturas).catch((e) => setError(e.message));
    api.get('/ventas/pedidos?estado=DESPACHADO').then(setPedidosDespachados);
  }
  useEffect(load, []);

  async function facturar(id) {
    setError(''); setOk('');
    try {
      const res = await api.post(`/despacho/pedidos/${id}/facturar`);
      setOk(`Factura ${res.numero} emitida. CUFE generado y transmitido. Total: $${Number(res.total).toLocaleString('es-CO')}.`);
      load();
    } catch (err) { setError(err.message); }
  }

  async function verFactura(id) {
    const d = await api.get(`/despacho/facturas/${id}`);
    setDetalle(d);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Facturación Electrónica</h1>
      <p className="text-slate-500 text-sm mb-5">Liquidación de subtotal + IVA − retenciones, transmisión fiscal (CUFE) y salida definitiva de kardex</p>

      {error && <div className="mb-4 text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</div>}
      {ok && <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{ok}</div>}

      {hasRole('CONTABILIDAD') && pedidosDespachados.length > 0 && (
        <div className="card p-5 mb-6">
          <h2 className="font-semibold text-slate-700 mb-3">Pedidos despachados pendientes de facturar</h2>
          <div className="space-y-2">
            {pedidosDespachados.map((p) => (
              <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b last:border-0 pb-2">
                <div className="text-sm"><b>{p.numero}</b> — {p.cliente_nombre} — ${Number(p.total).toLocaleString('es-CO')}</div>
                <button className="btn btn-primary btn-sm" onClick={() => facturar(p.id)}>Emitir Factura</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead><tr><th>Número</th><th>Cliente</th><th>Total</th><th>Estado DIAN</th><th></th></tr></thead>
          <tbody>
            {facturas.map((f) => (
              <tr key={f.id}>
                <td className="font-mono">{f.numero}</td>
                <td>{f.cliente_nombre}</td>
                <td>${Number(f.total).toLocaleString('es-CO')}</td>
                <td><span className="badge badge-green">{f.estado_dian}</span></td>
                <td><button className="btn btn-secondary btn-sm" onClick={() => verFactura(f.id)}>Ver detalle</button></td>
              </tr>
            ))}
            {facturas.length === 0 && <tr><td colSpan={5} className="text-center text-slate-400 py-6">Sin facturas emitidas.</td></tr>}
          </tbody>
        </table>
      </div>

      {detalle && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-30 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-xl max-h-[90vh] overflow-y-auto p-5">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">{detalle.numero}</h2>
                <p className="text-sm text-slate-500">{detalle.cliente_nombre}</p>
                <p className="text-xs text-slate-400 font-mono mt-1 break-all">CUFE: {detalle.cufe}</p>
              </div>
              <button onClick={() => setDetalle(null)} className="text-slate-400 hover:text-slate-700 text-xl">✕</button>
            </div>
            <table className="data-table mb-4">
              <thead><tr><th>Producto</th><th>Lote</th><th>Vence</th><th>Reg. Sanitario</th><th>Cant.</th></tr></thead>
              <tbody>
                {detalle.detalle_lotes.map((d, i) => (
                  <tr key={i}><td>{d.producto}</td><td className="font-mono">{d.numero_lote}</td><td>{d.fecha_vencimiento}</td><td>{d.registro_sanitario}</td><td>{d.cantidad}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="text-sm space-y-1 text-right">
              <div>Subtotal: ${Number(detalle.subtotal).toLocaleString('es-CO')}</div>
              <div>IVA: ${Number(detalle.iva_total).toLocaleString('es-CO')}</div>
              <div>Retenciones: -${Number(detalle.retenciones_total).toLocaleString('es-CO')}</div>
              <div className="font-bold text-base">Total: ${Number(detalle.total).toLocaleString('es-CO')}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
