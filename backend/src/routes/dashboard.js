const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const terceros = db.prepare(`SELECT COUNT(*) c FROM terceros WHERE activo=1`).get().c;
  const enCuarentena = db.prepare(`SELECT COUNT(*) c FROM lotes WHERE estado='CUARENTENA'`).get().c;
  const ocAbiertas = db.prepare(`SELECT COUNT(*) c FROM ordenes_compra WHERE estado IN ('GENERADA','RECIBIDA_PARCIAL')`).get().c;
  const pedidosPendCredito = db.prepare(`SELECT COUNT(*) c FROM pedidos WHERE estado='PENDIENTE_CREDITO'`).get().c;
  const pedidosBloqueados = db.prepare(`SELECT COUNT(*) c FROM pedidos WHERE estado='BLOQUEADO_CREDITO'`).get().c;
  const pedidosReservados = db.prepare(`SELECT COUNT(*) c FROM pedidos WHERE estado='RESERVADO'`).get().c;
  const facturasHoy = db.prepare(`SELECT COUNT(*) c FROM facturas WHERE date(fecha)=date('now')`).get().c;
  const ventasMes = db.prepare(`SELECT COALESCE(SUM(total),0) t FROM facturas WHERE strftime('%Y-%m', fecha) = strftime('%Y-%m','now')`).get().t;
  const proximosVencer = db.prepare(`
    SELECT l.numero_lote, p.nombre as producto, l.fecha_vencimiento, l.cantidad_disponible
    FROM lotes l JOIN productos p ON p.id = l.producto_id
    WHERE l.estado = 'DISPONIBLE' AND julianday(l.fecha_vencimiento) - julianday('now') <= 60
    ORDER BY l.fecha_vencimiento ASC LIMIT 10
  `).all();

  res.json({
    terceros_activos: terceros,
    lotes_en_cuarentena: enCuarentena,
    ordenes_compra_abiertas: ocAbiertas,
    pedidos_pendientes_credito: pedidosPendCredito,
    pedidos_bloqueados_credito: pedidosBloqueados,
    pedidos_reservados_por_despachar: pedidosReservados,
    facturas_emitidas_hoy: facturasHoy,
    ventas_facturadas_mes_actual: ventasMes,
    lotes_proximos_vencer: proximosVencer,
  });
});

module.exports = router;
