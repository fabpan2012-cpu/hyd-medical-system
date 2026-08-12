const db = require('../db');

const insertAudit = db.prepare(`
  INSERT INTO audit_log (usuario_id, username, role_codigo, accion, entidad, entidad_id, descripcion, datos_antes, datos_despues, ip)
  VALUES (@usuario_id, @username, @role_codigo, @accion, @entidad, @entidad_id, @descripcion, @datos_antes, @datos_despues, @ip)
`);

/**
 * Registra una acción de auditoría.
 * @param {object} req - request de express (para tomar usuario e ip)
 * @param {object} params - { accion, entidad, entidad_id, descripcion, antes, despues }
 */
function logAudit(req, { accion, entidad, entidad_id, descripcion, antes, despues }) {
  insertAudit.run({
    usuario_id: req.user ? req.user.id : null,
    username: req.user ? req.user.username : 'ANONIMO',
    role_codigo: req.user ? req.user.role_codigo : null,
    accion,
    entidad,
    entidad_id: entidad_id != null ? String(entidad_id) : null,
    descripcion: descripcion || null,
    datos_antes: antes ? JSON.stringify(antes) : null,
    datos_despues: despues ? JSON.stringify(despues) : null,
    ip: req.ip,
  });
}

module.exports = { logAudit };
