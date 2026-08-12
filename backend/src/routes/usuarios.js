const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(authenticate);

router.get('/roles', (req, res) => {
  res.json(db.prepare('SELECT * FROM roles ORDER BY nombre').all());
});

router.get('/', authorize('ADMIN'), (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.username, u.email, u.nombre_completo, u.activo, u.ultimo_login, u.created_at,
           r.codigo as role_codigo, r.nombre as role_nombre
    FROM usuarios u JOIN roles r ON r.id = u.role_id
    ORDER BY u.nombre_completo
  `).all();
  res.json(rows);
});

router.post('/', authorize('ADMIN'), (req, res) => {
  const { username, email, password, nombre_completo, role_codigo } = req.body;
  if (!username || !email || !password || !nombre_completo || !role_codigo) {
    return res.status(400).json({ error: 'Todos los campos son requeridos.' });
  }
  if (password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener mínimo 8 caracteres.' });

  const role = db.prepare('SELECT id FROM roles WHERE codigo = ?').get(role_codigo);
  if (!role) return res.status(400).json({ error: 'Rol inválido.' });

  try {
    const hash = bcrypt.hashSync(password, 10);
    const info = db.prepare(`
      INSERT INTO usuarios (username, email, password_hash, nombre_completo, role_id)
      VALUES (?,?,?,?,?)
    `).run(username, email, hash, nombre_completo, role.id);
    logAudit(req, { accion: 'CREATE', entidad: 'USUARIO', entidad_id: info.lastInsertRowid, descripcion: `Usuario creado: ${username}`, despues: { username, email, nombre_completo, role_codigo } });
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: 'El usuario o email ya existe.' });
  }
});

router.patch('/:id/estado', authorize('ADMIN'), (req, res) => {
  const { activo } = req.body;
  const before = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
  if (!before) return res.status(404).json({ error: 'Usuario no encontrado.' });
  db.prepare('UPDATE usuarios SET activo = ?, updated_at = datetime(\'now\') WHERE id = ?').run(activo ? 1 : 0, req.params.id);
  logAudit(req, {
    accion: activo ? 'ACTIVATE' : 'DEACTIVATE', entidad: 'USUARIO', entidad_id: req.params.id,
    descripcion: `Usuario ${activo ? 'activado' : 'desactivado'}: ${before.username}`,
    antes: { activo: before.activo }, despues: { activo },
  });
  res.json({ ok: true });
});

router.patch('/:id/rol', authorize('ADMIN'), (req, res) => {
  const { role_codigo } = req.body;
  const role = db.prepare('SELECT id FROM roles WHERE codigo = ?').get(role_codigo);
  if (!role) return res.status(400).json({ error: 'Rol inválido.' });
  const before = db.prepare('SELECT u.*, r.codigo as role_codigo FROM usuarios u JOIN roles r ON r.id=u.role_id WHERE u.id = ?').get(req.params.id);
  if (!before) return res.status(404).json({ error: 'Usuario no encontrado.' });
  db.prepare('UPDATE usuarios SET role_id = ?, updated_at = datetime(\'now\') WHERE id = ?').run(role.id, req.params.id);
  logAudit(req, {
    accion: 'UPDATE', entidad: 'USUARIO', entidad_id: req.params.id,
    descripcion: `Rol cambiado para ${before.username}`,
    antes: { role_codigo: before.role_codigo }, despues: { role_codigo },
  });
  res.json({ ok: true });
});

router.post('/:id/reset-password', authorize('ADMIN'), (req, res) => {
  const { new_password } = req.body;
  if (!new_password || new_password.length < 8) return res.status(400).json({ error: 'Contraseña muy corta.' });
  const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE usuarios SET password_hash = ?, debe_cambiar_password = 1, updated_at = datetime(\'now\') WHERE id = ?').run(hash, req.params.id);
  logAudit(req, { accion: 'UPDATE', entidad: 'USUARIO', entidad_id: req.params.id, descripcion: `Reset de contraseña para ${user.username}` });
  res.json({ ok: true });
});

module.exports = router;
