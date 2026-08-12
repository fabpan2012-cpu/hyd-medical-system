-- =====================================================================
-- HYD MEDICAL INSUMOS S.A.S. - ESQUEMA DE BASE DE DATOS
-- Basado en: Mapa y Flujo Detallado de Procesos
-- =====================================================================

-- ---------- SEGURIDAD: ROLES, USUARIOS, AUDITORIA ----------
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT UNIQUE NOT NULL,      -- ADMIN, CONTABILIDAD, COMPRAS, COMERCIAL, CARTERA, BODEGUERO, DIRECTOR_TECNICO, VENDEDOR, GERENCIA, SISTEMA
  nombre TEXT NOT NULL,
  descripcion TEXT
);

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nombre_completo TEXT NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  activo INTEGER NOT NULL DEFAULT 1,
  debe_cambiar_password INTEGER NOT NULL DEFAULT 1,
  ultimo_login TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Log de auditoria: registra TODAS las acciones de escritura del sistema
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER REFERENCES usuarios(id),
  username TEXT,
  role_codigo TEXT,
  accion TEXT NOT NULL,          -- CREATE, UPDATE, DELETE, LOGIN, LOGIN_FAILED, APPROVE, REJECT, BLOCK, OVERRIDE
  entidad TEXT NOT NULL,         -- TERCERO, ORDEN_COMPRA, LOTE, COTIZACION, PEDIDO, FACTURA, USUARIO...
  entidad_id TEXT,
  descripcion TEXT,
  datos_antes TEXT,              -- JSON snapshot antes del cambio
  datos_despues TEXT,            -- JSON snapshot despues del cambio
  ip TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ---------- PROCESO 1: TERCEROS (PROVEEDORES Y CLIENTES) ----------
CREATE TABLE IF NOT EXISTS terceros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL CHECK(tipo IN ('PROVEEDOR','CLIENTE','AMBOS')),
  nit_rut TEXT UNIQUE NOT NULL,
  razon_social TEXT NOT NULL,
  direccion TEXT,
  telefono TEXT,
  email_facturacion TEXT,
  -- 1.2 Configuracion tributaria
  regimen_fiscal TEXT CHECK(regimen_fiscal IN ('ORDINARIO','SIMPLE','GRAN_CONTRIBUYENTE')),
  auto_retenedor_refuente INTEGER NOT NULL DEFAULT 0,
  auto_retenedor_reteica INTEGER NOT NULL DEFAULT 0,
  auto_retenedor_reteiva INTEGER NOT NULL DEFAULT 0,
  -- 1.3 Definicion comercial - proveedor
  dias_credito_proveedor INTEGER,
  cuenta_bancaria TEXT,
  -- 1.3 Definicion comercial - cliente
  limite_credito_aprobado REAL DEFAULT 0,
  dias_pago_cliente INTEGER,
  direccion_despacho TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER REFERENCES usuarios(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ---------- PRODUCTOS (soporte para procesos 2-5) ----------
CREATE TABLE IF NOT EXISTS productos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  iva_tipo TEXT NOT NULL DEFAULT 'GRAVADO' CHECK(iva_tipo IN ('GRAVADO','EXENTO','EXCLUIDO')),
  iva_porcentaje REAL NOT NULL DEFAULT 19,
  precio_venta_sugerido REAL DEFAULT 0,
  requiere_registro_sanitario INTEGER NOT NULL DEFAULT 1,
  activo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ---------- PROCESO 2: COMPRAS, RECEPCION Y CUARENTENA ----------
CREATE TABLE IF NOT EXISTS ordenes_compra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT UNIQUE NOT NULL,
  proveedor_id INTEGER NOT NULL REFERENCES terceros(id),
  fecha TEXT DEFAULT (datetime('now')),
  estado TEXT NOT NULL DEFAULT 'GENERADA' CHECK(estado IN ('GENERADA','RECIBIDA_PARCIAL','RECIBIDA_TOTAL','CERRADA','ANULADA')),
  usuario_id INTEGER REFERENCES usuarios(id),
  observaciones TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orden_compra_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  orden_compra_id INTEGER NOT NULL REFERENCES ordenes_compra(id),
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  cantidad REAL NOT NULL,
  precio_compra_unitario REAL NOT NULL,
  valor_venta_sugerido REAL,
  cantidad_recibida REAL NOT NULL DEFAULT 0
);

-- 2.2 - 2.7: Lotes = Kardex con control sanitario y estados de cuarentena
CREATE TABLE IF NOT EXISTS lotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  orden_compra_id INTEGER REFERENCES ordenes_compra(id),
  orden_compra_item_id INTEGER REFERENCES orden_compra_items(id),
  numero_lote TEXT NOT NULL,
  fecha_vencimiento TEXT NOT NULL,
  registro_sanitario TEXT NOT NULL,
  temperatura_ingreso REAL,
  cantidad_ingresada REAL NOT NULL,
  cantidad_disponible REAL NOT NULL,   -- disminuye con reservas/salidas
  cantidad_reservada REAL NOT NULL DEFAULT 0,
  precio_compra_unitario REAL,
  valor_venta_sugerido REAL,
  ubicacion_bodega TEXT,
  -- 2.5 / 2.7: Estado del lote
  estado TEXT NOT NULL DEFAULT 'CUARENTENA' CHECK(estado IN ('CUARENTENA','DISPONIBLE','RECHAZADO','AGOTADO')),
  recibido_por INTEGER REFERENCES usuarios(id),
  fecha_recepcion TEXT DEFAULT (datetime('now')),
  -- 2.6 - 2.7: Inspeccion tecnica
  inspeccionado_por INTEGER REFERENCES usuarios(id),
  fecha_inspeccion TEXT,
  observaciones_inspeccion TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ---------- PROCESO 3: COTIZACION Y VENTA ----------
CREATE TABLE IF NOT EXISTS cotizaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT UNIQUE NOT NULL,
  cliente_id INTEGER NOT NULL REFERENCES terceros(id),
  vendedor_id INTEGER REFERENCES usuarios(id),
  fecha TEXT DEFAULT (datetime('now')),
  -- 3.2 validacion registro sanitario / 3.3 confirmacion
  estado TEXT NOT NULL DEFAULT 'BORRADOR' CHECK(estado IN ('BORRADOR','FRENADA_REG_SANITARIO','CONFIRMADA','ANULADA')),
  subtotal REAL DEFAULT 0,
  iva_total REAL DEFAULT 0,
  total REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cotizacion_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cotizacion_id INTEGER NOT NULL REFERENCES cotizaciones(id),
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  cantidad REAL NOT NULL,
  precio_venta_unitario REAL NOT NULL,
  iva_porcentaje REAL NOT NULL DEFAULT 19
);

-- 3.3 - 3.6: Pedido (nace al confirmar la cotizacion)
CREATE TABLE IF NOT EXISTS pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT UNIQUE NOT NULL,
  cotizacion_id INTEGER REFERENCES cotizaciones(id),
  cliente_id INTEGER NOT NULL REFERENCES terceros(id),
  vendedor_id INTEGER REFERENCES usuarios(id),
  fecha TEXT DEFAULT (datetime('now')),
  -- 3.4 evaluacion de credito
  estado TEXT NOT NULL DEFAULT 'PENDIENTE_CREDITO' CHECK(estado IN (
    'PENDIENTE_CREDITO','BLOQUEADO_CREDITO','APROBADO','RESERVADO',
    'PICKING','DESPACHADO','FACTURADO','ANULADO'
  )),
  credito_autorizado_por INTEGER REFERENCES usuarios(id), -- clave de gerencia override
  subtotal REAL DEFAULT 0,
  iva_total REAL DEFAULT 0,
  total REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pedido_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  cantidad REAL NOT NULL,
  precio_venta_unitario REAL NOT NULL,
  iva_porcentaje REAL NOT NULL DEFAULT 19
);

-- 3.5 - 3.6: Asignacion FEFO y reserva (detalle por lote)
CREATE TABLE IF NOT EXISTS pedido_lote_asignacion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_item_id INTEGER NOT NULL REFERENCES pedido_items(id),
  lote_id INTEGER NOT NULL REFERENCES lotes(id),
  cantidad_asignada REAL NOT NULL,
  estado TEXT NOT NULL DEFAULT 'RESERVADO' CHECK(estado IN ('RESERVADO','RECOLECTADO','DESPACHADO','LIBERADO')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- ---------- PROCESO 4: PICKING, DESPACHO Y FACTURACION ----------
CREATE TABLE IF NOT EXISTS remisiones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT UNIQUE NOT NULL,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
  bodeguero_id INTEGER REFERENCES usuarios(id),
  fecha TEXT DEFAULT (datetime('now')),
  estado TEXT NOT NULL DEFAULT 'GENERADA' CHECK(estado IN ('GENERADA','CONFIRMADA'))
);

CREATE TABLE IF NOT EXISTS facturas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT UNIQUE NOT NULL,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
  cliente_id INTEGER NOT NULL REFERENCES terceros(id),
  subtotal REAL NOT NULL,
  iva_total REAL NOT NULL,
  retenciones_total REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  -- 4.4 Transmision API fiscal (simulada)
  estado_dian TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK(estado_dian IN ('PENDIENTE','ENVIADA','ACEPTADA','RECHAZADA')),
  cufe TEXT,
  fecha TEXT DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_lotes_producto_estado ON lotes(producto_id, estado, fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_audit_entidad ON audit_log(entidad, entidad_id);
CREATE INDEX IF NOT EXISTS idx_terceros_nit ON terceros(nit_rut);
