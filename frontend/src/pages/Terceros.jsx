import { useEffect, useState } from 'react';
import { api } from '../api/client';

const emptyForm = {
  tipo: 'CLIENTE', nit_rut: '', razon_social: '', direccion: '', telefono: '', email_facturacion: '',
  regimen_fiscal: 'ORDINARIO', auto_retenedor_refuente: false, auto_retenedor_reteica: false, auto_retenedor_reteiva: false,
  dias_credito_proveedor: '', cuenta_bancaria: '',
  limite_credito_aprobado: '', dias_pago_cliente: '', direccion_despacho: '',
};

export default function Terceros() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  function load() {
    api.get(`/terceros${q ? `?q=${encodeURIComponent(q)}` : ''}`).then(setItems).catch((e) => setError(e.message));
  }
  useEffect(load, [q]);

  async function submit(e) {
    e.preventDefault();
    setError(''); setOk('');
    try {
      await api.post('/terceros', {
        ...form,
        dias_credito_proveedor: form.dias_credito_proveedor ? Number(form.dias_credito_proveedor) : null,
        limite_credito_aprobado: form.limite_credito_aprobado ? Number(form.limite_credito_aprobado) : 0,
        dias_pago_cliente: form.dias_pago_cliente ? Number(form.dias_pago_cliente) : null,
      });
      setOk('Tercero registrado y activado correctamente.');
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Terceros</h1>
          <p className="text-slate-500 text-sm">Proveedores y Clientes — captura fiscal, tributaria y comercial</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : '+ Nuevo Tercero'}
        </button>
      </div>

      {error && <div className="mb-4 text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</div>}
      {ok && <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{ok}</div>}

      {showForm && (
        <form onSubmit={submit} className="card p-5 mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Tipo</label>
              <select className="input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                <option value="CLIENTE">Cliente</option>
                <option value="PROVEEDOR">Proveedor</option>
                <option value="AMBOS">Ambos</option>
              </select>
            </div>
            <div>
              <label className="label">NIT / RUT</label>
              <input className="input" required value={form.nit_rut} onChange={(e) => setForm({ ...form, nit_rut: e.target.value })} />
            </div>
            <div>
              <label className="label">Razón Social</label>
              <input className="input" required value={form.razon_social} onChange={(e) => setForm({ ...form, razon_social: e.target.value })} />
            </div>
            <div>
              <label className="label">Dirección</label>
              <input className="input" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
            </div>
            <div>
              <label className="label">Teléfono</label>
              <input className="input" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </div>
            <div>
              <label className="label">Correo Facturación</label>
              <input className="input" type="email" value={form.email_facturacion} onChange={(e) => setForm({ ...form, email_facturacion: e.target.value })} />
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold text-sm text-slate-600 mb-3">Configuración Tributaria</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="label">Régimen Fiscal</label>
                <select className="input" value={form.regimen_fiscal} onChange={(e) => setForm({ ...form, regimen_fiscal: e.target.value })}>
                  <option value="ORDINARIO">Ordinario</option>
                  <option value="SIMPLE">Simple</option>
                  <option value="GRAN_CONTRIBUYENTE">Gran Contribuyente</option>
                </select>
              </div>
              <label className="flex items-center gap-2 mt-6 text-sm">
                <input type="checkbox" checked={form.auto_retenedor_refuente} onChange={(e) => setForm({ ...form, auto_retenedor_refuente: e.target.checked })} /> Auto-retenedor ReteFuente
              </label>
              <label className="flex items-center gap-2 mt-6 text-sm">
                <input type="checkbox" checked={form.auto_retenedor_reteica} onChange={(e) => setForm({ ...form, auto_retenedor_reteica: e.target.checked })} /> Auto-retenedor ReteICA
              </label>
              <label className="flex items-center gap-2 mt-6 text-sm">
                <input type="checkbox" checked={form.auto_retenedor_reteiva} onChange={(e) => setForm({ ...form, auto_retenedor_reteiva: e.target.checked })} /> Auto-retenedor ReteIVA
              </label>
            </div>
          </div>

          {(form.tipo === 'PROVEEDOR' || form.tipo === 'AMBOS') && (
            <div className="border-t pt-4">
              <h3 className="font-semibold text-sm text-slate-600 mb-3">Definición Comercial — Proveedor</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Días de Crédito</label>
                  <input className="input" type="number" value={form.dias_credito_proveedor} onChange={(e) => setForm({ ...form, dias_credito_proveedor: e.target.value })} />
                </div>
                <div>
                  <label className="label">Cuenta Bancaria</label>
                  <input className="input" value={form.cuenta_bancaria} onChange={(e) => setForm({ ...form, cuenta_bancaria: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          {(form.tipo === 'CLIENTE' || form.tipo === 'AMBOS') && (
            <div className="border-t pt-4">
              <h3 className="font-semibold text-sm text-slate-600 mb-3">Definición Comercial — Cliente</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="label">Límite de Crédito Aprobado</label>
                  <input className="input" type="number" value={form.limite_credito_aprobado} onChange={(e) => setForm({ ...form, limite_credito_aprobado: e.target.value })} />
                </div>
                <div>
                  <label className="label">Días de Pago</label>
                  <input className="input" type="number" value={form.dias_pago_cliente} onChange={(e) => setForm({ ...form, dias_pago_cliente: e.target.value })} />
                </div>
                <div>
                  <label className="label">Dirección de Despacho</label>
                  <input className="input" value={form.direccion_despacho} onChange={(e) => setForm({ ...form, direccion_despacho: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          <button type="submit" className="btn btn-primary">Guardar Tercero</button>
        </form>
      )}

      <input className="input mb-4 max-w-sm" placeholder="Buscar por razón social o NIT..." value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr><th>Tipo</th><th>NIT/RUT</th><th>Razón Social</th><th>Régimen</th><th>Crédito</th><th>Estado</th></tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id}>
                <td><span className="badge badge-blue">{t.tipo}</span></td>
                <td className="font-mono">{t.nit_rut}</td>
                <td>{t.razon_social}</td>
                <td>{t.regimen_fiscal || '—'}</td>
                <td>{t.tipo !== 'PROVEEDOR' ? `$${Number(t.limite_credito_aprobado).toLocaleString('es-CO')}` : '—'}</td>
                <td>{t.activo ? <span className="badge badge-green">Activo</span> : <span className="badge badge-gray">Inactivo</span>}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-6">Sin resultados.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
