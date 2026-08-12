import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import EstadoBadge from '../components/EstadoBadge';

export default function Cotizaciones() {
  const navigate = useNavigate();
  const [cotizaciones, setCotizaciones] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [clienteId, setClienteId] = useState('');
  const [items, setItems] = useState([{ producto_id: '', cantidad: '' }]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  function load() { api.get('/ventas/cotizaciones').then(setCotizaciones); }
  useEffect(() => {
    load();
    api.get('/terceros?tipo=CLIENTE').then(setClientes);
    api.get('/productos').then(setProductos);
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError(''); setOk('');
    try {
      const res = await api.post('/ventas/cotizaciones', {
        cliente_id: Number(clienteId),
        items: items.filter((i) => i.producto_id).map((i) => ({ producto_id: Number(i.producto_id), cantidad: Number(i.cantidad) })),
      });
      if (res.estado === 'FRENADA_REG_SANITARIO') {
        setError(`Cotización ${res.numero} generada pero FRENADA: ${res.error}`);
      } else {
        setOk(`Cotización ${res.numero} generada por $${res.totales.total.toLocaleString('es-CO')}.`);
      }
      setShowForm(false); setClienteId(''); setItems([{ producto_id: '', cantidad: '' }]);
      load();
    } catch (err) { setError(err.message); }
  }

  async function confirmar(id) {
    setError(''); setOk('');
    try {
      const res = await api.post(`/ventas/cotizaciones/${id}/confirmar`);
      setOk(`Pedido ${res.numero} generado. Continúe en Pedidos y Crédito.`);
      load();
    } catch (err) { setError(err.message); }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cotizaciones</h1>
          <p className="text-slate-500 text-sm">Carga automática de precio, IVA y validación de Registro Sanitario</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancelar' : '+ Nueva Cotización'}</button>
      </div>

      {error && <div className="mb-4 text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</div>}
      {ok && <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{ok}</div>}

      {showForm && (
        <form onSubmit={submit} className="card p-5 mb-6 space-y-4">
          <div>
            <label className="label">Cliente</label>
            <select className="input" required value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">Seleccione...</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="label">Productos y Cantidades</label>
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select className="input sm:col-span-2" value={it.producto_id} onChange={(e) => { const c = [...items]; c[idx].producto_id = e.target.value; setItems(c); }}>
                  <option value="">Producto...</option>
                  {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre} — ${Number(p.precio_venta_sugerido).toLocaleString('es-CO')}</option>)}
                </select>
                <input className="input" type="number" placeholder="Cantidad" value={it.cantidad} onChange={(e) => { const c = [...items]; c[idx].cantidad = e.target.value; setItems(c); }} />
              </div>
            ))}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setItems([...items, { producto_id: '', cantidad: '' }])}>+ Agregar producto</button>
          </div>
          <button className="btn btn-primary">Generar Cotización</button>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead><tr><th>Número</th><th>Cliente</th><th>Total</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {cotizaciones.map((c) => (
              <tr key={c.id}>
                <td className="font-mono">{c.numero}</td>
                <td>{c.cliente_nombre}</td>
                <td>${Number(c.total).toLocaleString('es-CO')}</td>
                <td><EstadoBadge estado={c.estado} /></td>
                <td>
                  {c.estado === 'BORRADOR' && <button className="btn btn-primary btn-sm" onClick={() => confirmar(c.id)}>Confirmar → Pedido</button>}
                  {c.estado === 'CONFIRMADA' && <button className="btn btn-secondary btn-sm" onClick={() => navigate('/pedidos')}>Ver Pedido</button>}
                </td>
              </tr>
            ))}
            {cotizaciones.length === 0 && <tr><td colSpan={5} className="text-center text-slate-400 py-6">Sin cotizaciones registradas.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
