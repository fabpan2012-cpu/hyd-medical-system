const express = require('express');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);
router.use(authorize('ADMIN', 'GERENCIA'));

router.get('/', (req, res) => {
  const { entidad, usuario, accion, desde, hasta, limit } = req.query;
  let sql = 'SELECT * FROM audit_log WHERE 1=1';
  const params = [];
  if (entidad) { sql += ' AND entidad = ?'; params.push(entidad); }
  if (usuario) { sql += ' AND username LIKE ?'; params.push(`%${usuario}%`); }
  if (accion) { sql += ' AND accion = ?'; params.push(accion); }
  if (desde) { sql += ' AND created_at >= ?'; params.push(desde); }
  if (hasta) { sql += ' AND created_at <= ?'; params.push(hasta); }
  sql += ' ORDER BY id DESC LIMIT ?';
  params.push(Number(limit) || 200);
  res.json(db.prepare(sql).all(...params));
});

router.get('/entidad/:entidad/:id', (req, res) => {
  const rows = db.prepare('SELECT * FROM audit_log WHERE entidad = ? AND entidad_id = ? ORDER BY id DESC').all(req.params.entidad, req.params.id);
  res.json(rows);
});

module.exports = router;
