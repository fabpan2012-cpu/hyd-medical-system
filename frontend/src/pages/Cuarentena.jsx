import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Cuarentena() {
  const { hasRole } = useAuth();
  const [lotes, setLotes] = useState([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [obs, setObs] = useState({});

  function load() { api.get('/compras/cuarentena').then(setLotes).catch((e) => setError(e.message)); }
  useEffect(load, []);

  async function inspeccionar(id, resultado) {
    setError(''); setOk('');
    try {
      await api.post(`/compras/lotes/${id}/inspeccion`, { resultado, observaciones: obs[id] || '' });
      setOk(`Lote ${resultado === 'APROBADO' ? 'liberado y disponible para venta' : 'rechazado/devolución'}.`);
      load();
    } catch (err) { setError(err.message); }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Cuarentena / Inspección de Calidad</h1>
      <p className="text-slate-500 text-sm mb-5">Revisión técnica de empaque, rotulado y vigencia de Registro Sanitario</p>

      {error && <div className="mb-4 text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</div>}
      {ok && <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{ok}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {lotes.map((l) => (
          <div key={l.id} className="card p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-bold">{l.producto_nombre}</div>
                <div className="text-xs text-slate-500 font-mono">Lote {l.numero_lote} · OC {l.oc_numero}</div>
              </div>
              <span className="badge badge-yellow">Cuarentena</span>
            </div>
            <div className="text-sm text-slate-600 space-y-1 mb-3">
              <div>Vencimiento: <b>{l.fecha_vencimiento}</b></div>
              <div>Registro Sanitario: <b>{l.registro_sanitario}</b></div>
              <div>Cantidad ingresada: <b>{l.cantidad_ingresada}</b></div>
              {l.temperatura_ingreso != null && <div>Temp. ingreso: <b>{l.temperatura_ingreso}°C</b></div>}
            </div>
            {hasRole('DIRECTOR_TECNICO') && (
              <div className="space-y-2 border-t pt-3">
                <input className="input" placeholder="Observaciones de inspección" value={obs[l.id] || ''} onChange={(e) => setObs({ ...obs, [l.id]: e.target.value })} />
                <div className="flex gap-2">
                  <button className="btn btn-primary btn-sm flex-1" onClick={() => inspeccionar(l.id, 'APROBADO')}>✓ Liberar (Aprobar)</button>
                  <button className="btn btn-danger btn-sm flex-1" onClick={() => inspeccionar(l.id, 'RECHAZADO')}>✕ Rechazar</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {lotes.length === 0 && <div className="text-slate-400 col-span-2 text-center py-10">No hay lotes pendientes de inspección.</div>}
      </div>
    </div>
  );
}
