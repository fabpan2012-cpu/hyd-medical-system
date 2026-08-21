import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const empty = { codigo: '', nombre: '', descripcion: '', iva_tipo: 'GRAVADO', iva_porcentaje: 19, precio_venta_sugerido: '', requiere_registro_sanitario: true };

export default function Productos() {
  const { hasRole } = useAuth();
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  function load() { api.get('/productos').then(setItems).catch((e) => setError(e.message)); }
  useEffect(load, []);

  function startEdit(p) {
    setEditingId(p.id);
    setForm({
      codigo: p.codigo, nombre: p.nombre, descripcion: p.descripcion || '',
      iva_tipo: p.iva_tipo, iva_porcentaje: p.iva_porcentaje,
      precio_venta_sugerido: p.precio_venta_sugerido, requiere_registro_sanitario: !!p.requiere_registro_sanitario,
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false); setEditingId(null); setForm(empty);
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const payload = { ...form, precio_venta_sugerido: Number(form.precio_venta_sugerido) || 0 };
      if (editingId) {
        await api.put(`/productos/${editingId}`, payload);
      } else {
        await api.post('/productos', payload);
      }
      setForm(empty); setEditingId(null); setShowForm(false); load();
    } catch (err) { setError(err.message); }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Productos</h1>
          <p className="text-slate-500 text-sm">Catálogo base para compras y ventas</p>
        </div>
        {hasRole('COMPRAS', 'CONTABILIDAD') && (
          <button className="btn btn-primary" onClick={() => (showForm ? cancelForm() : setShowForm(true))}>
            {showForm ? 'Cancelar' : '+ Nuevo Producto'}
          </button>
        )}
      </div>

      {error && <div className="mb-4 text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</div>}

      {showForm && (
        <form onSubmit={submit} className="card p-5 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><label className="label">Código</label><input className="input" required value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} /></div>
          <div className="md:col-span-2"><label className="label">Nombre</label><input className="input" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
          <div className="md:col-span-3"><label className="label">Descripción</label><input className="input" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div>
          <div>
            <label className="label">IVA</label>
            <select className="input" value={form.iva_tipo} onChange={(e) => setForm({ ...form, iva_tipo: e.target.value, iva_porcentaje: e.target.value === 'GRAVADO' ? 19 : 0 })}>
              <option value="GRAVADO">Gravado (19%)</option>
              <option value="EXENTO">Exento</option>
              <option value="EXCLUIDO">Excluido</option>
            </select>
          </div>
          <div><label className="label">Precio Venta Sugerido</label><input className="input" type="number" value={form.precio_venta_sugerido} onChange={(e) => setForm({ ...form, precio_venta_sugerido: e.target.value })} /></div>
          <label className="flex items-center gap-2 mt-6 text-sm">
            <input type="checkbox" checked={form.requiere_registro_sanitario} onChange={(e) => setForm({ ...form, requiere_registro_sanitario: e.target.checked })} />
            Requiere Registro Sanitario
          </label>
          <div className="md:col-span-3">
            <button className="btn btn-primary">{editingId ? 'Guardar Cambios' : 'Guardar Producto'}</button>
          </div>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead><tr><th>Código</th><th>Nombre</th><th>IVA</th><th>Precio Sugerido</th><th>Reg. Sanitario</th><th></th></tr></thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td className="font-mono">{p.codigo}</td>
                <td>{p.nombre}</td>
                <td>{p.iva_tipo} {p.iva_porcentaje ? `(${p.iva_porcentaje}%)` : ''}</td>
                <td>${Number(p.precio_venta_sugerido).toLocaleString('es-CO')}</td>
                <td>{p.requiere_registro_sanitario ? <span className="badge badge-yellow">Requerido</span> : <span className="badge badge-gray">No aplica</span>}</td>
                <td>
                  {hasRole('COMPRAS', 'CONTABILIDAD') && (
                    <button className="btn btn-secondary btn-sm" onClick={() => startEdit(p)}>Editar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
