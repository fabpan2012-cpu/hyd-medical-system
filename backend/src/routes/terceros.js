const express = require('express');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(authenticate);

// 1.5 Listado (disponible para transacciones)
router.get('/', (req, res) => {
  const { tipo, q } = req.query;
  let sql = 'SELECT * FROM terceros WHERE 1=1';
  const params = [];
  if (tipo) { sql += ' AND (tipo = ? OR tipo = "AMBOS")'; params.push(tipo); }
  if (q) { sql += ' AND (razon_social LIKE ? OR nit_rut LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  sql += ' ORDER BY razon_social';
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM terceros WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Tercero no encontrado.' });
  res.json(t);
});

// 1.1 - 1.4: Captura de datos fiscales + validación de duplicados (SISTEMA Auto vía UNIQUE constraint)
router.post('/', authorize('CONTABILIDAD', 'COMPRAS', 'COMERCIAL', 'CARTERA'), (req, res) => {
  const b = req.body;
  if (!b.nit_rut || !b.razon_social || !b.tipo) {
    return res.status(400).json({ error: 'NIT/RUT, Razón Social y Tipo son obligatorios.' });
  }

  // 1.4 Validación de duplicados
  const dup = db.prepare('SELECT id FROM terceros WHERE nit_rut = ?').get(b.nit_rut);
  if (dup) return res.status(409).json({ error: `Ya existe un tercero registrado con NIT/RUT ${b.nit_rut}.` });

  const info = db.prepare(`
    INSERT INTO terceros (
      tipo, nit_rut, razon_social, direccion, telefono, email_facturacion,
      regimen_fiscal, auto_retenedor_refuente, auto_retenedor_reteica, auto_retenedor_reteiva,
      dias_credito_proveedor, cuenta_bancaria,
      limite_credito_aprobado, dias_pago_cliente, direccion_despacho,
      created_by
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    b.tipo, b.nit_rut, b.razon_social, b.direccion || null, b.telefono || null, b.email_facturacion || null,
    b.regimen_fiscal || null, b.auto_retenedor_refuente ? 1 : 0, b.auto_retenedor_reteica ? 1 : 0, b.auto_retenedor_reteiva ? 1 : 0,
    b.dias_credito_proveedor || null, b.cuenta_bancaria || null,
    b.limite_credito_aprobado || 0, b.dias_pago_cliente || null, b.direccion_despacho || null,
    req.user.id
  );

  // 1.5 Registro y activación (ID_Tercero autogenerado, disponible de inmediato)
  logAudit(req, { accion: 'CREATE', entidad: 'TERCERO', entidad_id: info.lastInsertRowid, descripcion: `Tercero creado: ${b.razon_social} (${b.nit_rut})`, despues: b });
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/:id', authorize('CONTABILIDAD', 'COMPRAS', 'COMERCIAL', 'CARTERA'), (req, res) => {
  const before = db.prepare('SELECT * FROM terceros WHERE id = ?').get(req.params.id);
  if (!before) return res.status(404).json({ error: 'Tercero no encontrado.' });
  const b = req.body;

  db.prepare(`
    UPDATE terceros SET
      tipo=?, razon_social=?, direccion=?, telefono=?, email_facturacion=?,
      regimen_fiscal=?, auto_retenedor_refuente=?, auto_retenedor_reteica=?, auto_retenedor_reteiva=?,
      dias_credito_proveedor=?, cuenta_bancaria=?,
      limite_credito_aprobado=?, dias_pago_cliente=?, direccion_despacho=?,
      activo=?, updated_at=datetime('now')
    WHERE id=?
  `).run(
    b.tipo, b.razon_social, b.direccion || null, b.telefono || null, b.email_facturacion || null,
    b.regimen_fiscal || null, b.auto_retenedor_refuente ? 1 : 0, b.auto_retenedor_reteica ? 1 : 0, b.auto_retenedor_reteiva ? 1 : 0,
    b.dias_credito_proveedor || null, b.cuenta_bancaria || null,
    b.limite_credito_aprobado ?? before.limite_credito_aprobado, b.dias_pago_cliente || null, b.direccion_despacho || null,
    b.activo != null ? (b.activo ? 1 : 0) : before.activo,
    req.params.id
  );

  logAudit(req, { accion: 'UPDATE', entidad: 'TERCERO', entidad_id: req.params.id, descripcion: `Tercero actualizado: ${before.razon_social}`, antes: before, despues: b });
  res.json({ ok: true });
});

// Info de cartera del cliente (para evaluación de crédito - Proceso 3.4)
router.get('/:id/cartera', (req, res) => {
  const tercero = db.prepare('SELECT * FROM terceros WHERE id = ?').get(req.params.id);
  if (!tercero) return res.status(404).json({ error: 'Tercero no encontrado.' });

  const saldoCartera = db.prepare(`
    SELECT COALESCE(SUM(total),0) as saldo FROM facturas WHERE cliente_id = ? AND estado_dian != 'RECHAZADA'
  `).get(req.params.id).saldo;

  const pedidosPendientes = db.prepare(`
    SELECT COALESCE(SUM(total),0) as pendiente FROM pedidos
    WHERE cliente_id = ? AND estado IN ('PENDIENTE_CREDITO','APROBADO','RESERVADO','PICKING')
  `).get(req.params.id).pendiente;

  res.json({
    tercero_id: tercero.id,
    limite_credito_aprobado: tercero.limite_credito_aprobado,
    saldo_cartera_facturado: saldoCartera,
    pedidos_en_proceso: pedidosPendientes,
    disponible: tercero.limite_credito_aprobado - saldoCartera - pedidosPendientes,
  });
});

module.exports = router;
