import { useEffect, useState } from 'react';
import { api } from '../api/client';
import EstadoBadge from '../components/EstadoBadge';
import { useAuth } from '../context/AuthContext';

export default function Compras() {
  const { hasRole } = useAuth();
  const [ordenes, setOrdenes] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const [proveedorId, setProveedorId] = useState('');
  const [items, setItems] = useState([{ producto_id: '', cantidad: '', precio_compra_unitario: '' }]);

  function load() { api.get('/compras/ordenes').then(setOrdenes).catch((e) => setError(e.message)); }
  useEffect(() => {
    load();
    api.get('/terceros?tipo=PROVEEDOR').then(setProveedores);
    api.get('/productos').then(setProductos);
  }, []);

  async function openDetail(id) {
    const d = await api.get(`/compras/ordenes/${id}`);
    setSelected(d);
  }

  async function submitOC(e) {
    e.preventDefault();
    setError(''); setOk('');
    try {
      await api.post('/compras/ordenes', {
        proveedor_id: Number(proveedorId),
        items: items.filter((i) => i.producto_id).map((i) => ({ producto_id: Number(i.producto_id), cantidad: Number(i.cantidad), precio_compra_unitario: Number(i.precio_compra_unitario) })),
      });
      setOk('Orden de compra generada.');
      setShowForm(false); setProveedorId(''); setItems([{ producto_id: '', cantidad: '', precio_compra_unitario: '' }]);
      load();
    } catch (err) { setError(err.message); }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Órdenes de Compra</h1>
          <p className="text-slate-500 text-sm">Generación, recepción física y captura de datos sanitarios</p>
        </div>
        {hasRole('COMPRAS') && <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancelar' : '+ Nueva Orden'}</button>}
      </div>

      {error && <div className="mb-4 text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</div>}
      {ok && <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{ok}</div>}

      {showForm && (
        <form onSubmit={submitOC} className="card p-5 mb-6 space-y-4">
          <div>
            <label className="label">Proveedor</label>
            <select className="input" required value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
              <option value="">Seleccione...</option>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.razon_social} ({p.nit_rut})</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="label">Ítems (Productos, Cantidades, Precio de Compra Pactado)</label>
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <select className="input sm:col-span-2" value={it.producto_id} onChange={(e) => { const c = [...items]; c[idx].producto_id = e.target.value; setItems(c); }}>
                  <option value="">Producto...</option>
                  {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
                <input className="input" type="number" placeholder="Cantidad" value={it.cantidad} onChange={(e) => { const c = [...items]; c[idx].cantidad = e.target.value; setItems(c); }} />
                <input className="input" type="number" placeholder="Precio compra unit." value={it.precio_compra_unitario} onChange={(e) => { const c = [...items]; c[idx].precio_compra_unitario = e.target.value; setItems(c); }} />
              </div>
            ))}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setItems([...items, { producto_id: '', cantidad: '', precio_compra_unitario: '' }])}>+ Agregar ítem</button>
          </div>
          <button className="btn btn-primary">Generar Orden de Compra</button>
        </form>
      )}

      <div className="card overflow-x-auto mb-6">
        <table className="data-table">
          <thead><tr><th>Número</th><th>Proveedor</th><th>Fecha</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {ordenes.map((o) => (
              <tr key={o.id}>
                <td className="font-mono">{o.numero}</td>
                <td>{o.proveedor_nombre}</td>
                <td>{o.fecha?.slice(0, 10)}</td>
                <td><EstadoBadge estado={o.estado} /></td>
                <td><button className="btn btn-secondary btn-sm" onClick={() => openDetail(o.id)}>Ver / Recepción</button></td>
              </tr>
            ))}
            {ordenes.length === 0 && <tr><td colSpan={5} className="text-center text-slate-400 py-6">Sin órdenes registradas.</td></tr>}
          </tbody>
        </table>
      </div>

      {selected && <DetalleOC oc={selected} onClose={() => setSelected(null)} onUpdated={() => { openDetail(selected.id); load(); }} canReceive={hasRole('BODEGUERO')} />}
    </div>
  );
}

function DetalleOC({ oc, onClose, onUpdated, canReceive }) {
  const [form, setForm] = useState({ orden_compra_item_id: '', numero_lote: '', fecha_vencimiento: '', registro_sanitario: '', temperatura_ingreso: '', cantidad: '', ubicacion_bodega: '' });
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError(''); setOk('');
    try {
      await api.post(`/compras/ordenes/${oc.id}/recepcion`, {
        ...form,
        orden_compra_item_id: Number(form.orden_compra_item_id),
        cantidad: Number(form.cantidad),
        temperatura_ingreso: form.temperatura_ingreso ? Number(form.temperatura_ingreso) : null,
      });
      setOk('Recepción registrada. Lote ingresado en estado CUARENTENA (no suma a stock disponible).');
      setForm({ orden_compra_item_id: '', numero_lote: '', fecha_vencimiento: '', registro_sanitario: '', temperatura_ingreso: '', cantidad: '', ubicacion_bodega: '' });
      onUpdated();
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-30 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-xl max-h-[90vh] overflow-y-auto p-5">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-bold">{oc.numero}</h2>
            <p className="text-sm text-slate-500">{oc.proveedor_nombre} — <EstadoBadge estado={oc.estado} /></p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl">✕</button>
        </div>

        <table className="data-table mb-5">
          <thead><tr><th>Producto</th><th>Cant.</th><th>Recibida</th><th>Precio</th></tr></thead>
          <tbody>
            {oc.items.map((it) => (
              <tr key={it.id}><td>{it.producto_nombre}</td><td>{it.cantidad}</td><td>{it.cantidad_recibida}</td><td>${Number(it.precio_compra_unitario).toLocaleString('es-CO')}</td></tr>
            ))}
          </tbody>
        </table>

        <h3 className="font-semibold text-sm text-slate-600 mb-2">Lotes recibidos</h3>
        <table className="data-table mb-5">
          <thead><tr><th>Lote</th><th>Vence</th><th>Reg. Sanitario</th><th>Cant.</th><th>Estado</th></tr></thead>
          <tbody>
            {oc.lotes.map((l) => (
              <tr key={l.id}><td className="font-mono">{l.numero_lote}</td><td>{l.fecha_vencimiento}</td><td>{l.registro_sanitario}</td><td>{l.cantidad_ingresada}</td><td><EstadoBadge estado={l.estado} /></td></tr>
            ))}
            {oc.lotes.length === 0 && <tr><td colSpan={5} className="text-center text-slate-400 py-4">Sin lotes recibidos aún.</td></tr>}
          </tbody>
        </table>

        {canReceive && oc.estado !== 'CERRADA' && oc.estado !== 'ANULADA' && (
          <form onSubmit={submit} className="border-t pt-4 space-y-3">
            <h3 className="font-semibold text-sm text-slate-600">Confrontación física / Formulario sanitario (2.2 - 2.3)</h3>
            {error && <div className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</div>}
            {ok && <div className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{ok}</div>}
            <select className="input" required value={form.orden_compra_item_id} onChange={(e) => setForm({ ...form, orden_compra_item_id: e.target.value })}>
              <option value="">Ítem de la OC...</option>
              {oc.items.map((it) => <option key={it.id} value={it.id}>{it.producto_nombre} (pendiente: {it.cantidad - it.cantidad_recibida})</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input className="input" placeholder="N° Lote" required value={form.numero_lote} onChange={(e) => setForm({ ...form, numero_lote: e.target.value })} />
              <input className="input" type="date" required value={form.fecha_vencimiento} onChange={(e) => setForm({ ...form, fecha_vencimiento: e.target.value })} />
              <input className="input" placeholder="Registro Sanitario" required value={form.registro_sanitario} onChange={(e) => setForm({ ...form, registro_sanitario: e.target.value })} />
              <input className="input" type="number" placeholder="Temperatura ingreso (°C)" value={form.temperatura_ingreso} onChange={(e) => setForm({ ...form, temperatura_ingreso: e.target.value })} />
              <input className="input" type="number" placeholder="Cantidad recibida" required value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
              <input className="input" placeholder="Ubicación en bodega" value={form.ubicacion_bodega} onChange={(e) => setForm({ ...form, ubicacion_bodega: e.target.value })} />
            </div>
            <button className="btn btn-primary">Registrar Recepción (→ Cuarentena)</button>
          </form>
        )}
      </div>
    </div>
  );
}
