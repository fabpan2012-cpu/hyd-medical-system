const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authenticate, JWT_SECRET } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });

  const user = db.prepare(`
    SELECT u.*, r.codigo as role_codigo, r.nombre as role_nombre
    FROM usuarios u JOIN roles r ON r.id = u.role_id
    WHERE u.username = ?
  `).get(username);

  if (!user || !user.activo) {
    logAudit(req, { accion: 'LOGIN_FAILED', entidad: 'USUARIO', descripcion: `Intento fallido para usuario: ${username}` });
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    logAudit(req, { accion: 'LOGIN_FAILED', entidad: 'USUARIO', entidad_id: user.id, descripcion: `Contraseña incorrecta: ${username}` });
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  }

  const payload = {
    id: user.id, username: user.username, nombre_completo: user.nombre_completo,
    role_codigo: user.role_codigo, role_nombre: user.role_nombre,
  };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });

  db.prepare('UPDATE usuarios SET ultimo_login = datetime(\'now\') WHERE id = ?').run(user.id);
  req.user = payload;
  logAudit(req, { accion: 'LOGIN', entidad: 'USUARIO', entidad_id: user.id, descripcion: `Login exitoso: ${username}` });

  res.json({ token, user: payload, debe_cambiar_password: !!user.debe_cambiar_password });
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

router.post('/change-password', authenticate, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!new_password || new_password.length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
  }
  const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(400).json({ error: 'La contraseña actual es incorrecta.' });
  }
  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE usuarios SET password_hash = ?, debe_cambiar_password = 0, updated_at = datetime(\'now\') WHERE id = ?').run(hash, req.user.id);
  logAudit(req, { accion: 'UPDATE', entidad: 'USUARIO', entidad_id: req.user.id, descripcion: 'Cambio de contraseña propio' });
  res.json({ ok: true });
});

module.exports = router;
