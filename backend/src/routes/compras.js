const express = require('express');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(authenticate);

function generarNumero(prefijo, tabla) {
  const count = db.prepare(`SELECT COUNT(*) c FROM ${tabla}`).get().c + 1;
  return `${prefijo}-${String(count).padStart(6, '0')}`;
}

// ---------- 2.1 Generación de Orden de Compra ----------
router.get('/ordenes', (req, res) => {
  const rows = db.prepare(`
    SELECT oc.*, t.razon_social as proveedor_nombre, u.nombre_completo as usuario_nombre
    FROM ordenes_compra oc
    JOIN terceros t ON t.id = oc.proveedor_id
    LEFT JOIN usuarios u ON u.id = oc.usuario_id
    ORDER BY oc.id DESC
  `).all();
  res.json(rows);
});

router.get('/ordenes/:id', (req, res) => {
  const oc = db.prepare(`
    SELECT oc.*, t.razon_social as proveedor_nombre FROM ordenes_compra oc
    JOIN terceros t ON t.id = oc.proveedor_id WHERE oc.id = ?
  `).get(req.params.id);
  if (!oc) return res.status(404).json({ error: 'Orden de compra no encontrada.' });
  const items = db.prepare(`
    SELECT oci.*, p.nombre as producto_nombre, p.codigo as producto_codigo, p.requiere_registro_sanitario
    FROM orden_compra_items oci JOIN productos p ON p.id = oci.producto_id
    WHERE orden_compra_id = ?
  `).all(req.params.id);
  const lotes = db.prepare(`SELECT * FROM lotes WHERE orden_compra_id = ?`).all(req.params.id);
  res.json({ ...oc, items, lotes });
});

router.post('/ordenes', authorize('COMPRAS'), (req, res) => {
  const { proveedor_id, items, observaciones } = req.body;
  if (!proveedor_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Proveedor y al menos un ítem son requeridos.' });
  }
  const proveedor = db.prepare('SELECT * FROM terceros WHERE id = ? AND activo = 1').get(proveedor_id);
  if (!proveedor || (proveedor.tipo !== 'PROVEEDOR' && proveedor.tipo !== 'AMBOS')) {
    return res.status(400).json({ error: 'Proveedor inválido o inactivo.' });
  }

  const numero = generarNumero('OC', 'ordenes_compra');
  const tx = db.transaction(() => {
    const info = db.prepare(`INSERT INTO ordenes_compra (numero, proveedor_id, usuario_id, observaciones) VALUES (?,?,?,?)`)
      .run(numero, proveedor_id, req.user.id, observaciones || null);
    const ocId = info.lastInsertRowid;
    const insertItem = db.prepare(`
      INSERT INTO orden_compra_items (orden_compra_id, producto_id, cantidad, precio_compra_unitario, valor_venta_sugerido)
      VALUES (?,?,?,?,?)
    `);
    for (const it of items) {
      if (!it.producto_id || !it.cantidad || it.precio_compra_unitario == null) {
        throw new Error('Cada ítem requiere producto, cantidad y precio de compra.');
      }
      insertItem.run(ocId, it.producto_id, it.cantidad, it.precio_compra_unitario, it.valor_venta_sugerido || null);
    }
    return ocId;
  });

  try {
    const ocId = tx();
    logAudit(req, { accion: 'CREATE', entidad: 'ORDEN_COMPRA', entidad_id: ocId, descripcion: `OC ${numero} creada para proveedor ${proveedor.razon_social}`, despues: { proveedor_id, items } });
    res.status(201).json({ id: ocId, numero });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ---------- 2.2 - 2.5: Recepción física + datos sanitarios + precios/impuestos -> Cuarentena automática ----------
router.post('/ordenes/:id/recepcion', authorize('BODEGUERO'), (req, res) => {
  const oc = db.prepare('SELECT * FROM ordenes_compra WHERE id = ?').get(req.params.id);
  if (!oc) return res.status(404).json({ error: 'Orden de compra no encontrada.' });
  if (oc.estado === 'CERRADA' || oc.estado === 'ANULADA') {
    return res.status(400).json({ error: `La orden está ${oc.estado} y no admite recepciones.` });
  }

  const { orden_compra_item_id, numero_lote, fecha_vencimiento, registro_sanitario, temperatura_ingreso, cantidad, ubicacion_bodega } = req.body;
  if (!orden_compra_item_id || !numero_lote || !fecha_vencimiento || !registro_sanitario || !cantidad) {
    return res.status(400).json({ error: '2.3 Formulario sanitario incompleto: Lote, Fecha Vencimiento, Registro Sanitario y Cantidad son obligatorios.' });
  }

  const item = db.prepare('SELECT * FROM orden_compra_items WHERE id = ? AND orden_compra_id = ?').get(orden_compra_item_id, req.params.id);
  if (!item) return res.status(404).json({ error: 'Ítem de la orden de compra no encontrado.' });

  const pendiente = item.cantidad - item.cantidad_recibida;
  if (cantidad > pendiente) {
    return res.status(400).json({ error: `Confrontación física fallida: cantidad recibida (${cantidad}) supera lo pendiente en la Orden de Compra (${pendiente}).` });
  }

  const tx = db.transaction(() => {
    // 2.5 Bloqueo a cuarentena automático: NO se suma a stock disponible
    const infoLote = db.prepare(`
      INSERT INTO lotes (
        producto_id, orden_compra_id, orden_compra_item_id, numero_lote, fecha_vencimiento, registro_sanitario,
        temperatura_ingreso, cantidad_ingresada, cantidad_disponible, precio_compra_unitario, valor_venta_sugerido,
        ubicacion_bodega, estado, recibido_por
      ) VALUES (?,?,?,?,?,?,?,?,0,?,?,?, 'CUARENTENA', ?)
    `).run(
      item.producto_id, req.params.id, item.id, numero_lote, fecha_vencimiento, registro_sanitario,
      temperatura_ingreso || null, cantidad, item.precio_compra_unitario, item.valor_venta_sugerido,
      ubicacion_bodega || null, req.user.id
    );

    db.prepare('UPDATE orden_compra_items SET cantidad_recibida = cantidad_recibida + ? WHERE id = ?').run(cantidad, item.id);

    const totales = db.prepare('SELECT SUM(cantidad) tot, SUM(cantidad_recibida) rec FROM orden_compra_items WHERE orden_compra_id = ?').get(req.params.id);
    const nuevoEstado = totales.rec >= totales.tot ? 'RECIBIDA_TOTAL' : 'RECIBIDA_PARCIAL';
    db.prepare('UPDATE ordenes_compra SET estado = ? WHERE id = ?').run(nuevoEstado, req.params.id);

    return infoLote.lastInsertRowid;
  });

  const loteId = tx();
  logAudit(req, {
    accion: 'CREATE', entidad: 'LOTE', entidad_id: loteId,
    descripcion: `Recepción física OC ${oc.numero}, lote ${numero_lote} ingresado en CUARENTENA (no suma a stock disponible)`,
    despues: req.body,
  });
  res.status(201).json({ lote_id: loteId, estado: 'CUARENTENA' });
});

// ---------- 2.6 - 2.7: Inspección de calidad -> Liberación o Rechazo ----------
router.get('/cuarentena', authorize('DIRECTOR_TECNICO', 'BODEGUERO'), (req, res) => {
  const rows = db.prepare(`
    SELECT l.*, p.nombre as producto_nombre, p.codigo as producto_codigo, oc.numero as oc_numero
    FROM lotes l JOIN productos p ON p.id = l.producto_id
    LEFT JOIN ordenes_compra oc ON oc.id = l.orden_compra_id
    WHERE l.estado = 'CUARENTENA'
    ORDER BY l.fecha_recepcion ASC
  `).all();
  res.json(rows);
});

router.post('/lotes/:id/inspeccion', authorize('DIRECTOR_TECNICO'), (req, res) => {
  const { resultado, observaciones } = req.body; // resultado: 'APROBADO' | 'RECHAZADO'
  if (!['APROBADO', 'RECHAZADO'].includes(resultado)) {
    return res.status(400).json({ error: 'Resultado debe ser APROBADO o RECHAZADO.' });
  }
  const lote = db.prepare('SELECT * FROM lotes WHERE id = ?').get(req.params.id);
  if (!lote) return res.status(404).json({ error: 'Lote no encontrado.' });
  if (lote.estado !== 'CUARENTENA') return res.status(400).json({ error: `El lote no está en cuarentena (estado actual: ${lote.estado}).` });

  const nuevoEstado = resultado === 'APROBADO' ? 'DISPONIBLE' : 'RECHAZADO';
  const cantidadDisponible = resultado === 'APROBADO' ? lote.cantidad_ingresada : 0;

  db.prepare(`
    UPDATE lotes SET estado = ?, cantidad_disponible = ?, inspeccionado_por = ?, fecha_inspeccion = datetime('now'), observaciones_inspeccion = ?
    WHERE id = ?
  `).run(nuevoEstado, cantidadDisponible, req.user.id, observaciones || null, req.params.id);

  logAudit(req, {
    accion: resultado === 'APROBADO' ? 'APPROVE' : 'REJECT', entidad: 'LOTE', entidad_id: req.params.id,
    descripcion: `Inspección técnica lote ${lote.numero_lote}: ${resultado}. ${resultado === 'APROBADO' ? 'Se recarga el Kardex.' : 'Pasa a Rechazado/Devolución.'}`,
    antes: { estado: lote.estado }, despues: { estado: nuevoEstado, observaciones },
  });

  res.json({ ok: true, estado: nuevoEstado });
});

module.exports = router;
