const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(authenticate);

function generarNumero(prefijo, tabla) {
  const count = db.prepare(`SELECT COUNT(*) c FROM ${tabla}`).get().c + 1;
  return `${prefijo}-${String(count).padStart(6, '0')}`;
}

// ---------- 4.1 Generación lista de picking ----------
router.get('/picking/:pedidoId', authorize('BODEGUERO'), (req, res) => {
  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.pedidoId);
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado.' });
  const lista = db.prepare(`
    SELECT pla.id as asignacion_id, pla.cantidad_asignada, pla.estado,
           l.numero_lote, l.ubicacion_bodega, l.fecha_vencimiento,
           p.codigo as producto_codigo, p.nombre as producto_nombre
    FROM pedido_lote_asignacion pla
    JOIN lotes l ON l.id = pla.lote_id
    JOIN pedido_items pi ON pi.id = pla.pedido_item_id
    JOIN productos p ON p.id = pi.producto_id
    WHERE pi.pedido_id = ?
    ORDER BY l.ubicacion_bodega
  `).all(req.params.pedidoId);
  res.json({ pedido, lista_picking: lista });
});

// ---------- 4.2 Empaque, confirmación y Remisión de salida ----------
router.post('/picking/:pedidoId/confirmar', authorize('BODEGUERO'), (req, res) => {
  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.pedidoId);
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado.' });
  if (pedido.estado !== 'RESERVADO') return res.status(400).json({ error: `El pedido debe estar RESERVADO para confirmar picking (estado actual: ${pedido.estado}).` });

  const numero = generarNumero('REM', 'remisiones');
  const tx = db.transaction(() => {
    const info = db.prepare(`INSERT INTO remisiones (numero, pedido_id, bodeguero_id, estado) VALUES (?,?,?, 'CONFIRMADA')`)
      .run(numero, req.params.pedidoId, req.user.id);
    db.prepare(`UPDATE pedido_lote_asignacion SET estado = 'RECOLECTADO' WHERE pedido_item_id IN (SELECT id FROM pedido_items WHERE pedido_id = ?)`).run(req.params.pedidoId);
    db.prepare(`UPDATE pedidos SET estado = 'DESPACHADO' WHERE id = ?`).run(req.params.pedidoId);
    return info.lastInsertRowid;
  });

  const remId = tx();
  logAudit(req, { accion: 'CREATE', entidad: 'REMISION', entidad_id: remId, descripcion: `Remisión ${numero} generada, picking confirmado para pedido ${pedido.numero}` });
  res.status(201).json({ remision_id: remId, numero, estado: 'DESPACHADO' });
});

// ---------- 4.3 - 4.5: Emisión de factura + transmisión DIAN (simulada) + salida de Kardex ----------
router.post('/pedidos/:id/facturar', authorize('CONTABILIDAD'), (req, res) => {
  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.id);
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado.' });
  if (pedido.estado !== 'DESPACHADO') return res.status(400).json({ error: `El pedido debe estar DESPACHADO para facturar (estado actual: ${pedido.estado}).` });

  const cliente = db.prepare('SELECT * FROM terceros WHERE id = ?').get(pedido.cliente_id);

  // 4.3 Liquidación: Subtotal + IVA - Retenciones según configuración del cliente
  let retenciones = 0;
  if (cliente.auto_retenedor_refuente) retenciones += pedido.subtotal * 0.025; // ReteFuente aprox 2.5%
  if (cliente.auto_retenedor_reteica) retenciones += pedido.subtotal * 0.01;   // ReteICA aprox 1%
  if (cliente.auto_retenedor_reteiva) retenciones += pedido.iva_total * 0.15;  // ReteIVA aprox 15% del IVA
  const total = pedido.subtotal + pedido.iva_total - retenciones;

  const numero = generarNumero('FE', 'facturas');
  // 4.4 Transmisión API fiscal (simulada) - genera CUFE
  const cufe = crypto.createHash('sha256').update(`${numero}-${pedido.id}-${Date.now()}`).digest('hex');

  const tx = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO facturas (numero, pedido_id, cliente_id, subtotal, iva_total, retenciones_total, total, estado_dian, cufe, created_by)
      VALUES (?,?,?,?,?,?,?, 'ACEPTADA', ?, ?)
    `).run(numero, pedido.id, pedido.cliente_id, pedido.subtotal, pedido.iva_total, retenciones, total, cufe, req.user.id);

    // 4.5 Salida definitiva de Kardex: cantidad_reservada -> se descuenta definitivamente; si llega a 0 el lote pasa a AGOTADO
    const asignaciones = db.prepare(`
      SELECT pla.* FROM pedido_lote_asignacion pla
      JOIN pedido_items pi ON pi.id = pla.pedido_item_id WHERE pi.pedido_id = ?
    `).all(pedido.id);
    for (const a of asignaciones) {
      db.prepare(`UPDATE lotes SET cantidad_reservada = cantidad_reservada - ? WHERE id = ?`).run(a.cantidad_asignada, a.lote_id);
      db.prepare(`UPDATE pedido_lote_asignacion SET estado = 'DESPACHADO' WHERE id = ?`).run(a.id);
      const lote = db.prepare('SELECT * FROM lotes WHERE id = ?').get(a.lote_id);
      if (lote.cantidad_disponible <= 0 && lote.cantidad_reservada <= 0) {
        db.prepare(`UPDATE lotes SET estado = 'AGOTADO' WHERE id = ?`).run(a.lote_id);
      }
    }

    db.prepare(`UPDATE pedidos SET estado = 'FACTURADO' WHERE id = ?`).run(pedido.id);
    return info.lastInsertRowid;
  });

  const facturaId = tx();
  logAudit(req, {
    accion: 'CREATE', entidad: 'FACTURA', entidad_id: facturaId,
    descripcion: `Factura ${numero} emitida para pedido ${pedido.numero}. CUFE: ${cufe.slice(0, 16)}... Kardex descontado definitivamente.`,
    despues: { subtotal: pedido.subtotal, iva: pedido.iva_total, retenciones, total },
  });

  res.status(201).json({ id: facturaId, numero, cufe, subtotal: pedido.subtotal, iva_total: pedido.iva_total, retenciones_total: retenciones, total });
});

router.get('/facturas', authorize('CONTABILIDAD', 'GERENCIA'), (req, res) => {
  const rows = db.prepare(`
    SELECT f.*, t.razon_social as cliente_nombre, p.numero as pedido_numero
    FROM facturas f JOIN terceros t ON t.id = f.cliente_id JOIN pedidos p ON p.id = f.pedido_id
    ORDER BY f.id DESC
  `).all();
  res.json(rows);
});

// Detalle de factura con Lote, Vencimiento y Registro Sanitario (4.5)
router.get('/facturas/:id', authorize('CONTABILIDAD', 'GERENCIA', 'VENDEDOR'), (req, res) => {
  const f = db.prepare(`SELECT f.*, t.razon_social as cliente_nombre FROM facturas f JOIN terceros t ON t.id=f.cliente_id WHERE f.id=?`).get(req.params.id);
  if (!f) return res.status(404).json({ error: 'Factura no encontrada.' });
  const detalle = db.prepare(`
    SELECT pr.codigo, pr.nombre as producto, pla.cantidad_asignada as cantidad, l.numero_lote, l.fecha_vencimiento, l.registro_sanitario
    FROM pedido_lote_asignacion pla
    JOIN lotes l ON l.id = pla.lote_id
    JOIN pedido_items pi ON pi.id = pla.pedido_item_id
    JOIN productos pr ON pr.id = pi.producto_id
    WHERE pi.pedido_id = ?
  `).all(f.pedido_id);
  res.json({ ...f, detalle_lotes: detalle });
});

module.exports = router;
