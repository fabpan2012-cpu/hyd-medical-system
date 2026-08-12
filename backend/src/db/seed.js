const bcrypt = require('bcryptjs');
const db = require('./index');

const ROLES = [
  ['ADMIN', 'Administrador del Sistema', 'Control total, gestión de usuarios y auditoría'],
  ['SISTEMA', 'Sistema (Automático)', 'Acciones automáticas del sistema (validaciones, FEFO, kardex)'],
  ['CONTABILIDAD', 'Contabilidad', 'Gestión tributaria, precios, impuestos, facturación'],
  ['COMPRAS', 'Compras', 'Creación de terceros proveedores y órdenes de compra'],
  ['COMERCIAL', 'Comercial', 'Definición comercial de clientes/proveedores'],
  ['CARTERA', 'Cartera', 'Límites de crédito y condiciones de pago de clientes'],
  ['BODEGUERO', 'Bodeguero', 'Recepción física, datos sanitarios, picking y despacho'],
  ['DIRECTOR_TECNICO', 'Director Técnico', 'Inspección de calidad, liberación o rechazo de lotes'],
  ['VENDEDOR', 'Vendedor', 'Elaboración de cotizaciones y pedidos'],
  ['GERENCIA', 'Gerencia', 'Autorización de excepciones de crédito (clave de gerencia)'],
];

const insertRole = db.prepare('INSERT OR IGNORE INTO roles (codigo, nombre, descripcion) VALUES (?,?,?)');
const tx = db.transaction(() => {
  for (const r of ROLES) insertRole.run(...r);
});
tx();

function ensureUser(username, email, password, nombre, roleCodigo) {
  const exists = db.prepare('SELECT id FROM usuarios WHERE username = ?').get(username);
  if (exists) return;
  const role = db.prepare('SELECT id FROM roles WHERE codigo = ?').get(roleCodigo);
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(`INSERT INTO usuarios (username, email, password_hash, nombre_completo, role_id, debe_cambiar_password)
              VALUES (?,?,?,?,?,0)`).run(username, email, hash, nombre, role.id);
  console.log(`Usuario creado: ${username} / ${password} (rol ${roleCodigo})`);
}

ensureUser('admin', 'admin@hydmedical.com', 'Admin#2026', 'Administrador General', 'ADMIN');
ensureUser('compras', 'compras@hydmedical.com', 'Compras#2026', 'Usuario Compras', 'COMPRAS');
ensureUser('bodega', 'bodega@hydmedical.com', 'Bodega#2026', 'Usuario Bodega', 'BODEGUERO');
ensureUser('tecnico', 'tecnico@hydmedical.com', 'Tecnico#2026', 'Director Técnico', 'DIRECTOR_TECNICO');
ensureUser('vendedor', 'vendedor@hydmedical.com', 'Vendedor#2026', 'Usuario Vendedor', 'VENDEDOR');
ensureUser('gerencia', 'gerencia@hydmedical.com', 'Gerencia#2026', 'Gerencia General', 'GERENCIA');
ensureUser('contabilidad', 'contabilidad@hydmedical.com', 'Contable#2026', 'Usuario Contabilidad', 'CONTABILIDAD');

// Productos demo
const prodCount = db.prepare('SELECT COUNT(*) c FROM productos').get().c;
if (prodCount === 0) {
  const insertProd = db.prepare(`INSERT INTO productos (codigo, nombre, descripcion, iva_tipo, iva_porcentaje, precio_venta_sugerido, requiere_registro_sanitario)
                                  VALUES (?,?,?,?,?,?,1)`);
  insertProd.run('INS-001', 'Guantes de Nitrilo Talla M (Caja x100)', 'Guantes de examinación no estériles', 'GRAVADO', 19, 45000);
  insertProd.run('INS-002', 'Jeringa Desechable 5ml', 'Jeringa estéril de un solo uso', 'EXENTO', 0, 800);
  insertProd.run('INS-003', 'Alcohol Antiséptico 70% (Galón)', 'Solución antiséptica para desinfección', 'GRAVADO', 19, 32000);
  console.log('Productos demo creados');
}

console.log('Seed completado.');
