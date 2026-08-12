const express = require('express');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const { q } = req.query;
  let sql = 'SELECT * FROM productos WHERE activo = 1';
  const params = [];
  if (q) { sql += ' AND (nombre LIKE ? OR codigo LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  sql += ' ORDER BY nombre';
  res.json(db.prepare(sql).all(...params));
});

// Existencias por producto (para vendedores / compras)
router.get('/:id/existencias', (req, res) => {
  const lotes = db.prepare(`
    SELECT id, numero_lote, fecha_vencimiento, cantidad_disponible, cantidad_reservada, estado, ubicacion_bodega
    FROM lotes WHERE producto_id = ? AND estado IN ('DISPONIBLE','CUARENTENA')
    ORDER BY fecha_vencimiento ASC
  `).all(req.params.id);
  const totalDisponible = lotes.filter(l => l.estado === 'DISPONIBLE').reduce((s, l) => s + l.cantidad_disponible, 0);
  res.json({ lotes, total_disponible: totalDisponible });
});

router.post('/', authorize('COMPRAS', 'CONTABILIDAD'), (req, res) => {
  const b = req.body;
  if (!b.codigo || !b.nombre) return res.status(400).json({ error: 'Código y nombre son requeridos.' });
  try {
    const info = db.prepare(`
      INSERT INTO productos (codigo, nombre, descripcion, iva_tipo, iva_porcentaje, precio_venta_sugerido, requiere_registro_sanitario)
      VALUES (?,?,?,?,?,?,?)
    `).run(b.codigo, b.nombre, b.descripcion || null, b.iva_tipo || 'GRAVADO', b.iva_porcentaje ?? 19, b.precio_venta_sugerido || 0, b.requiere_registro_sanitario === false ? 0 : 1);
    logAudit(req, { accion: 'CREATE', entidad: 'PRODUCTO', entidad_id: info.lastInsertRowid, descripcion: `Producto creado: ${b.nombre}`, despues: b });
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: 'El código de producto ya existe.' });
  }
});

module.exports = router;
