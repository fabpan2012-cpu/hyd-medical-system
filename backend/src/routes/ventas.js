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

function calcularTotales(items) {
  let subtotal = 0, iva = 0;
  for (const it of items) {
    const lineSub = it.cantidad * it.precio_venta_unitario;
    subtotal += lineSub;
    iva += lineSub * (it.iva_porcentaje / 100);
  }
  return { subtotal, iva_total: iva, total: subtotal + iva };
}

// ---------- 3.1 Elaboración de cotización ----------
router.get('/cotizaciones', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, t.razon_social as cliente_nombre, u.nombre_completo as vendedor_nombre
    FROM cotizaciones c JOIN terceros t ON t.id = c.cliente_id
    LEFT JOIN usuarios u ON u.id = c.vendedor_id
    ORDER BY c.id DESC
  `).all();
  res.json(rows);
});

router.get('/cotizaciones/:id', (req, res) => {
  const c = db.prepare(`SELECT c.*, t.razon_social as cliente_nombre FROM cotizaciones c JOIN terceros t ON t.id=c.cliente_id WHERE c.id=?`).get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Cotización no encontrada.' });
  const items = db.prepare(`SELECT ci.*, p.nombre as producto_nombre, p.codigo, p.requiere_registro_sanitario FROM cotizacion_items ci JOIN productos p ON p.id=ci.producto_id WHERE cotizacion_id=?`).all(req.params.id);
  res.json({ ...c, items });
});

router.post('/cotizaciones', authorize('VENDEDOR'), (req, res) => {
  const { cliente_id, items } = req.body;
  if (!cliente_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cliente y al menos un ítem son requeridos.' });
  }
  const cliente = db.prepare('SELECT * FROM terceros WHERE id = ? AND activo = 1').get(cliente_id);
  if (!cliente || (cliente.tipo !== 'CLIENTE' && cliente.tipo !== 'AMBOS')) {
    return res.status(400).json({ error: 'Cliente inválido o inactivo.' });
  }

  // 3.1 Carga automática de precio de venta + calculo de IVA + 3.2 validación registro sanitario
  const enrichedItems = [];
  let estadoInicial = 'BORRADOR';
  let motivoFreno = null;
  for (const it of items) {
    const producto = db.prepare('SELECT * FROM productos WHERE id = ? AND activo = 1').get(it.producto_id);
    if (!producto) return res.status(400).json({ error: `Producto ${it.producto_id} no encontrado o inactivo.` });

    if (producto.requiere_registro_sanitario) {
      const loteVigente = db.prepare(`
        SELECT * FROM lotes WHERE producto_id = ? AND estado = 'DISPONIBLE' AND date(fecha_vencimiento) > date('now')
        ORDER BY fecha_vencimiento ASC LIMIT 1
      `).get(producto.id);
      if (!loteVigente) {
        estadoInicial = 'FRENADA_REG_SANITARIO';
        motivoFreno = `Producto ${producto.nombre}: sin lotes con Registro Sanitario vigente disponibles.`;
      }
    }

    enrichedItems.push({
      producto_id: producto.id,
      cantidad: it.cantidad,
      precio_venta_unitario: it.precio_venta_unitario ?? producto.precio_venta_sugerido,
      iva_porcentaje: producto.iva_porcentaje,
    });
  }

  const totales = calcularTotales(enrichedItems);
  const numero = generarNumero('COT', 'cotizaciones');

  const tx = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO cotizaciones (numero, cliente_id, vendedor_id, estado, subtotal, iva_total, total)
      VALUES (?,?,?,?,?,?,?)
    `).run(numero, cliente_id, req.user.id, estadoInicial, totales.subtotal, totales.iva_total, totales.total);
    const cotId = info.lastInsertRowid;
    const insertItem = db.prepare(`INSERT INTO cotizacion_items (cotizacion_id, producto_id, cantidad, precio_venta_unitario, iva_porcentaje) VALUES (?,?,?,?,?)`);
    for (const it of enrichedItems) insertItem.run(cotId, it.producto_id, it.cantidad, it.precio_venta_unitario, it.iva_porcentaje);
    return cotId;
  });

  const cotId = tx();
  logAudit(req, {
    accion: 'CREATE', entidad: 'COTIZACION', entidad_id: cotId,
    descripcion: `Cotización ${numero} para ${cliente.razon_social}. Estado: ${estadoInicial}.${motivoFreno ? ' ' + motivoFreno : ''}`,
    despues: { cliente_id, items: enrichedItems, totales },
  });

  if (estadoInicial === 'FRENADA_REG_SANITARIO') {
    return res.status(201).json({ id: cotId, numero, estado: estadoInicial, error: motivoFreno });
  }
  res.status(201).json({ id: cotId, numero, estado: estadoInicial, totales });
});

// ---------- 3.3 Confirmación de pedido (nace el Pedido) ----------
router.post('/cotizaciones/:id/confirmar', authorize('VENDEDOR'), (req, res) => {
  const cot = db.prepare('SELECT * FROM cotizaciones WHERE id = ?').get(req.params.id);
  if (!cot) return res.status(404).json({ error: 'Cotización no encontrada.' });
  if (cot.estado === 'FRENADA_REG_SANITARIO') {
    return res.status(400).json({ error: '3.2 Cotización frenada por Registro Sanitario vencido/no disponible. No se puede confirmar.' });
  }
  if (cot.estado !== 'BORRADOR') return res.status(400).json({ error: `La cotización está en estado ${cot.estado} y no puede confirmarse.` });

  const items = db.prepare('SELECT * FROM cotizacion_items WHERE cotizacion_id = ?').all(req.params.id);
  const numero = generarNumero('PED', 'pedidos');

  const tx = db.transaction(() => {
    db.prepare(`UPDATE cotizaciones SET estado = 'CONFIRMADA' WHERE id = ?`).run(req.params.id);
    const info = db.prepare(`
      INSERT INTO pedidos (numero, cotizacion_id, cliente_id, vendedor_id, estado, subtotal, iva_total, total)
      VALUES (?,?,?,?, 'PENDIENTE_CREDITO', ?,?,?)
    `).run(numero, cot.id, cot.cliente_id, cot.vendedor_id, cot.subtotal, cot.iva_total, cot.total);
    const pedidoId = info.lastInsertRowid;
    const insertItem = db.prepare(`INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio_venta_unitario, iva_porcentaje) VALUES (?,?,?,?,?)`);
    for (const it of items) insertItem.run(pedidoId, it.producto_id, it.cantidad, it.precio_venta_unitario, it.iva_porcentaje);
    return pedidoId;
  });

  const pedidoId = tx();
  logAudit(req, { accion: 'CREATE', entidad: 'PEDIDO', entidad_id: pedidoId, descripcion: `Pedido ${numero} generado desde cotización ${cot.numero}` });
  res.status(201).json({ pedido_id: pedidoId, numero });
});

// ---------- 3.4 Evaluación de crédito ----------
router.get('/pedidos', (req, res) => {
  const { estado } = req.query;
  let sql = `
    SELECT p.*, t.razon_social as cliente_nombre, u.nombre_completo as vendedor_nombre
    FROM pedidos p JOIN terceros t ON t.id = p.cliente_id
    LEFT JOIN usuarios u ON u.id = p.vendedor_id WHERE 1=1`;
  const params = [];
  if (estado) { sql += ' AND p.estado = ?'; params.push(estado); }
  sql += ' ORDER BY p.id DESC';
  res.json(db.prepare(sql).all(...params));
});

router.get('/pedidos/:id', (req, res) => {
  const p = db.prepare(`SELECT p.*, t.razon_social as cliente_nombre, t.limite_credito_aprobado FROM pedidos p JOIN terceros t ON t.id=p.cliente_id WHERE p.id=?`).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Pedido no encontrado.' });
  const items = db.prepare(`
    SELECT pi.*, pr.nombre as producto_nombre, pr.codigo
    FROM pedido_items pi JOIN productos pr ON pr.id = pi.producto_id WHERE pedido_id = ?
  `).all(req.params.id);
  for (const it of items) {
    it.asignaciones = db.prepare(`
      SELECT pla.*, l.numero_lote, l.fecha_vencimiento FROM pedido_lote_asignacion pla
      JOIN lotes l ON l.id = pla.lote_id WHERE pedido_item_id = ?
    `).all(it.id);
  }
  res.json({ ...p, items });
});

function evaluarCredito(pedido) {
  const saldoCartera = db.prepare(`SELECT COALESCE(SUM(total),0) s FROM facturas WHERE cliente_id = ? AND estado_dian != 'RECHAZADA'`).get(pedido.cliente_id).s;
  const otrosPedidos = db.prepare(`
    SELECT COALESCE(SUM(total),0) s FROM pedidos
    WHERE cliente_id = ? AND id != ? AND estado IN ('PENDIENTE_CREDITO','APROBADO','RESERVADO','PICKING')
  `).get(pedido.cliente_id, pedido.id).s;
  const cliente = db.prepare('SELECT * FROM terceros WHERE id = ?').get(pedido.cliente_id);

  // Facturas en mora > 30 días (simplificado: facturas sin marca de pago con fecha > 30 dias no se modela pago;
  // se aproxima usando estado_dian ACEPTADA y antigüedad, dado que el modelo no tiene pagos explícitos)
  const facturasMora = db.prepare(`
    SELECT COUNT(*) c FROM facturas
    WHERE cliente_id = ? AND estado_dian = 'ACEPTADA' AND julianday('now') - julianday(fecha) > 30
  `).get(pedido.cliente_id).c;

  const cumpleCupo = (saldoCartera + otrosPedidos + pedido.total) <= cliente.limite_credito_aprobado;
  const cumpleMora = facturasMora === 0;

  return { cumple: cumpleCupo && cumpleMora, cumpleCupo, cumpleMora, saldoCartera, otrosPedidos, limite: cliente.limite_credito_aprobado };
}

router.post('/pedidos/:id/evaluar-credito', authorize('VENDEDOR', 'CARTERA', 'GERENCIA'), (req, res) => {
  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.id);
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado.' });
  if (pedido.estado !== 'PENDIENTE_CREDITO') return res.status(400).json({ error: `El pedido está en estado ${pedido.estado}.` });

  const evaluacion = evaluarCredito(pedido);
  const nuevoEstado = evaluacion.cumple ? 'APROBADO' : 'BLOQUEADO_CREDITO';
  db.prepare('UPDATE pedidos SET estado = ? WHERE id = ?').run(nuevoEstado, req.params.id);

  logAudit(req, {
    accion: evaluacion.cumple ? 'APPROVE' : 'BLOCK', entidad: 'PEDIDO', entidad_id: req.params.id,
    descripcion: `Evaluación de crédito pedido ${pedido.numero}: ${nuevoEstado}. Cupo: ${evaluacion.cumpleCupo}, Sin mora >30d: ${evaluacion.cumpleMora}`,
    despues: evaluacion,
  });

  res.json({ estado: nuevoEstado, evaluacion });
});

// Override con clave de gerencia (3.4: "Requiere Clave de Gerencia")
router.post('/pedidos/:id/autorizar-gerencia', authorize('GERENCIA'), (req, res) => {
  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.id);
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado.' });
  if (pedido.estado !== 'BLOQUEADO_CREDITO') return res.status(400).json({ error: 'El pedido no está bloqueado por crédito.' });

  db.prepare('UPDATE pedidos SET estado = ?, credito_autorizado_por = ? WHERE id = ?').run('APROBADO', req.user.id, req.params.id);
  logAudit(req, {
    accion: 'OVERRIDE', entidad: 'PEDIDO', entidad_id: req.params.id,
    descripcion: `Bloqueo de crédito superado con Clave de Gerencia (${req.user.username}) para pedido ${pedido.numero}`,
  });
  res.json({ estado: 'APROBADO' });
});

// ---------- 3.5 - 3.6: Asignación FEFO y Reserva de inventario ----------
router.post('/pedidos/:id/asignar-fefo', authorize('VENDEDOR', 'BODEGUERO'), (req, res) => {
  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.id);
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado.' });
  if (pedido.estado !== 'APROBADO') return res.status(400).json({ error: `El pedido debe estar APROBADO para asignar inventario (estado actual: ${pedido.estado}).` });

  const items = db.prepare('SELECT * FROM pedido_items WHERE pedido_id = ?').all(req.params.id);
  const resultado = [];
  const tx = db.transaction(() => {
    for (const item of items) {
      let pendiente = item.cantidad;
      // 3.5 FEFO: lotes DISPONIBLE ordenados por fecha de vencimiento más cercana
      const lotes = db.prepare(`
        SELECT * FROM lotes WHERE producto_id = ? AND estado = 'DISPONIBLE' AND cantidad_disponible > 0
        ORDER BY fecha_vencimiento ASC
      `).all(item.producto_id);

      for (const lote of lotes) {
        if (pendiente <= 0) break;
        const asignar = Math.min(pendiente, lote.cantidad_disponible);
        // 3.6 Reserva: cambia a estado Reservado, no puede venderse en otra orden
        db.prepare(`UPDATE lotes SET cantidad_disponible = cantidad_disponible - ?, cantidad_reservada = cantidad_reservada + ? WHERE id = ?`)
          .run(asignar, asignar, lote.id);
        db.prepare(`INSERT INTO pedido_lote_asignacion (pedido_item_id, lote_id, cantidad_asignada) VALUES (?,?,?)`)
          .run(item.id, lote.id, asignar);
        pendiente -= asignar;
        resultado.push({ producto_id: item.producto_id, lote: lote.numero_lote, cantidad: asignar });
      }
      if (pendiente > 0) {
        throw new Error(`Inventario insuficiente para el producto ${item.producto_id}: faltan ${pendiente} unidades disponibles.`);
      }
    }
    db.prepare(`UPDATE pedidos SET estado = 'RESERVADO' WHERE id = ?`).run(req.params.id);
  });

  try {
    tx();
    logAudit(req, { accion: 'UPDATE', entidad: 'PEDIDO', entidad_id: req.params.id, descripcion: `Asignación FEFO y reserva de inventario completada para pedido ${pedido.numero}`, despues: resultado });
    res.json({ estado: 'RESERVADO', asignaciones: resultado });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
