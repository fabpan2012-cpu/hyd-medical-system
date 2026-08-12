import { useEffect, useState } from 'react';
import { api } from '../api/client';

const ENTIDADES = ['TERCERO', 'PRODUCTO', 'ORDEN_COMPRA', 'LOTE', 'COTIZACION', 'PEDIDO', 'REMISION', 'FACTURA', 'USUARIO'];
const ACCIONES = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGIN_FAILED', 'APPROVE', 'REJECT', 'BLOCK', 'OVERRIDE', 'ACTIVATE', 'DEACTIVATE'];

const ACCION_COLOR = {
  CREATE: 'green', UPDATE: 'blue', DELETE: 'red', LOGIN: 'gray', LOGIN_FAILED: 'red',
  APPROVE: 'green', REJECT: 'red', BLOCK: 'red', OVERRIDE: 'yellow', ACTIVATE: 'green', DEACTIVATE: 'gray',
};

export default function Auditoria() {
  const [logs, setLogs] = useState([]);
  const [filtros, setFiltros] = useState({ entidad: '', usuario: '', accion: '' });
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);

  function load() {
    const params = new URLSearchParams();
    if (filtros.entidad) params.set('entidad', filtros.entidad);
    if (filtros.usuario) params.set('usuario', filtros.usuario);
    if (filtros.accion) params.set('accion', filtros.accion);
    params.set('limit', '200');
    api.get(`/auditoria?${params.toString()}`).then(setLogs).catch((e) => setError(e.message));
  }
  useEffect(load, [filtros]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Auditoría del Sistema</h1>
      <p className="text-slate-500 text-sm mb-5">Registro inmutable de todas las acciones: usuario, rol, entidad, cambios y fecha</p>

      {error && <div className="mb-4 text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</div>}

      <div className="card p-4 mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <select className="input" value={filtros.entidad} onChange={(e) => setFiltros({ ...filtros, entidad: e.target.value })}>
          <option value="">Todas las entidades</option>
          {ENTIDADES.map((e) => <option key={e} value={e}>{e.replaceAll('_', ' ')}</option>)}
        </select>
        <select className="input" value={filtros.accion} onChange={(e) => setFiltros({ ...filtros, accion: e.target.value })}>
          <option value="">Todas las acciones</option>
          {ACCIONES.map((a) => <option key={a} value={a}>{a.replaceAll('_', ' ')}</option>)}
        </select>
        <input className="input" placeholder="Buscar usuario..." value={filtros.usuario} onChange={(e) => setFiltros({ ...filtros, usuario: e.target.value })} />
      </div>

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead><tr><th>Fecha</th><th>Usuario</th><th>Rol</th><th>Acción</th><th>Entidad</th><th>Descripción</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <>
                <tr key={l.id} className="cursor-pointer" onClick={() => setExpanded(expanded === l.id ? null : l.id)}>
                  <td className="whitespace-nowrap text-xs text-slate-500">{l.created_at}</td>
                  <td>{l.username}</td>
                  <td className="text-xs text-slate-500">{l.role_codigo}</td>
                  <td><span className={`badge badge-${ACCION_COLOR[l.accion] || 'gray'}`}>{l.accion}</span></td>
                  <td className="text-xs">{l.entidad} {l.entidad_id ? `#${l.entidad_id}` : ''}</td>
                  <td className="text-sm">{l.descripcion}</td>
                </tr>
                {expanded === l.id && (l.datos_antes || l.datos_despues) && (
                  <tr key={`${l.id}-detail`}>
                    <td colSpan={6} className="bg-slate-50 text-xs font-mono p-3">
                      {l.datos_antes && <div className="mb-2"><b>Antes:</b> {l.datos_antes}</div>}
                      {l.datos_despues && <div><b>Después:</b> {l.datos_despues}</div>}
                      <div className="text-slate-400 mt-2">IP: {l.ip}</div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {logs.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-6">Sin registros para los filtros seleccionados.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
