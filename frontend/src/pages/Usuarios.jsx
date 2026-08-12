import { useEffect, useState } from 'react';
import { api } from '../api/client';

const empty = { username: '', email: '', password: '', nombre_completo: '', role_codigo: '' };

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  function load() {
    api.get('/usuarios').then(setUsuarios).catch((e) => setError(e.message));
    api.get('/usuarios/roles').then(setRoles);
  }
  useEffect(load, []);

  async function submit(e) {
    e.preventDefault();
    setError(''); setOk('');
    try {
      await api.post('/usuarios', form);
      setOk(`Usuario ${form.username} creado correctamente.`);
      setForm(empty); setShowForm(false); load();
    } catch (err) { setError(err.message); }
  }

  async function toggleEstado(u) {
    setError(''); setOk('');
    try {
      await api.patch(`/usuarios/${u.id}/estado`, { activo: !u.activo });
      load();
    } catch (err) { setError(err.message); }
  }

  async function cambiarRol(u, role_codigo) {
    setError(''); setOk('');
    try {
      await api.patch(`/usuarios/${u.id}/rol`, { role_codigo });
      load();
    } catch (err) { setError(err.message); }
  }

  async function resetPassword(u) {
    const nueva = prompt(`Nueva contraseña temporal para ${u.username} (mínimo 8 caracteres):`);
    if (!nueva) return;
    setError(''); setOk('');
    try {
      await api.post(`/usuarios/${u.id}/reset-password`, { new_password: nueva });
      setOk(`Contraseña reiniciada para ${u.username}. El usuario deberá cambiarla al ingresar.`);
    } catch (err) { setError(err.message); }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Usuarios y Roles</h1>
          <p className="text-slate-500 text-sm">Control de acceso y perfiles del sistema</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancelar' : '+ Nuevo Usuario'}</button>
      </div>

      {error && <div className="mb-4 text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</div>}
      {ok && <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{ok}</div>}

      {showForm && (
        <form onSubmit={submit} className="card p-5 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="label">Usuario</label><input className="input" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
          <div><label className="label">Email</label><input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="label">Nombre Completo</label><input className="input" required value={form.nombre_completo} onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })} /></div>
          <div>
            <label className="label">Rol / Perfil</label>
            <select className="input" required value={form.role_codigo} onChange={(e) => setForm({ ...form, role_codigo: e.target.value })}>
              <option value="">Seleccione...</option>
              {roles.map((r) => <option key={r.id} value={r.codigo}>{r.nombre}</option>)}
            </select>
          </div>
          <div className="md:col-span-2"><label className="label">Contraseña temporal (mín. 8 caracteres)</label><input className="input" type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <div className="md:col-span-2"><button className="btn btn-primary">Crear Usuario</button></div>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Estado</th><th>Último login</th><th>Acciones</th></tr></thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td className="font-mono">{u.username}</td>
                <td>{u.nombre_completo}</td>
                <td>
                  <select className="input !py-1 !text-xs" value={u.role_codigo} onChange={(e) => cambiarRol(u, e.target.value)}>
                    {roles.map((r) => <option key={r.id} value={r.codigo}>{r.nombre}</option>)}
                  </select>
                </td>
                <td>{u.activo ? <span className="badge badge-green">Activo</span> : <span className="badge badge-gray">Inactivo</span>}</td>
                <td className="text-xs text-slate-500">{u.ultimo_login || 'Nunca'}</td>
                <td className="space-x-2 whitespace-nowrap">
                  <button className="btn btn-secondary btn-sm" onClick={() => resetPassword(u)}>Reset clave</button>
                  <button className={`btn btn-sm ${u.activo ? 'btn-danger' : 'btn-primary'}`} onClick={() => toggleEstado(u)}>{u.activo ? 'Desactivar' : 'Activar'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
