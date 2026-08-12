const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'CAMBIAR_ESTE_SECRETO_EN_PRODUCCION';

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado. Token requerido.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, username, role_codigo, nombre_completo }
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido o expirado.' });
  }
}

// Uso: authorize('COMPRAS','ADMIN')
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado.' });
    if (req.user.role_codigo === 'ADMIN') return next(); // ADMIN tiene acceso total
    if (!allowedRoles.includes(req.user.role_codigo)) {
      return res.status(403).json({ error: `Acceso denegado. Rol requerido: ${allowedRoles.join(', ')}` });
    }
    next();
  };
}

module.exports = { authenticate, authorize, JWT_SECRET };
