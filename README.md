# HYD Medical Insumos S.A.S. — Sistema de Gestión (SaaS)

Sistema de compra y venta de insumos médicos, implementado según el documento
**"Mapa y Flujo Detallado de Procesos"**. Arquitectura cliente-servidor: un backend
(API REST) y un frontend web responsive que se conecta a él. Se puede acceder
desde cualquier dispositivo (computador, tablet, celular) a través del navegador,
sin instalar nada.

## Arquitectura

```
┌─────────────────────┐        HTTPS / JSON        ┌──────────────────────┐
│   FRONTEND (web)     │  ────────────────────────▶ │   BACKEND (API)      │
│ React + Vite         │ ◀──────────────────────── │ Node.js + Express    │
│ Accesible desde       │        JWT en header        │ Base de datos SQLite │
│ cualquier navegador   │                             │ (portable a Postgres)│
└─────────────────────┘                             └──────────────────────┘
```

- **Backend**: Node.js + Express + SQLite (better-sqlite3). Expone una API REST.
  Se despliega en un solo servidor (o contenedor) y todos los clientes se conectan a él —
  esto es lo que lo hace "SaaS cliente-servidor": un solo backend, múltiples usuarios/dispositivos.
- **Frontend**: React + Vite + Tailwind CSS. Es una aplicación web responsive: el mismo
  código se adapta automáticamente a celular, tablet o escritorio. Se compila a archivos
  estáticos (HTML/CSS/JS) que se pueden alojar en cualquier servidor web o CDN.
- **Autenticación**: JWT (JSON Web Token), con expiración de 12 horas.
- **Base de datos**: SQLite por simplicidad de despliegue (un solo archivo). El esquema
  está escrito en SQL estándar y la capa de acceso está aislada en `backend/src/db`,
  por lo que migrar a PostgreSQL/MySQL para una operación multi-servidor es un cambio
  contenido a esa carpeta.

## Estructura del proyecto

```
hyd-medical-system/
├── backend/
│   ├── src/
│   │   ├── db/            → esquema SQL, conexión, seed de datos iniciales
│   │   ├── middleware/     → autenticación JWT y autorización por rol
│   │   ├── routes/         → endpoints de cada proceso de negocio
│   │   ├── utils/          → utilidad de auditoría
│   │   └── server.js       → punto de entrada del API
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── pages/           → una pantalla por proceso de negocio
    │   ├── components/      → Layout, badges, rutas protegidas
    │   ├── context/         → sesión de usuario (AuthContext)
    │   └── api/client.js    → cliente HTTP hacia el backend
    ├── package.json
    └── vite.config.js
```

## Perfiles de usuario (roles) implementados

Extraídos directamente de la columna "Responsable" del documento de procesos:

| Rol | Responsabilidades |
|---|---|
| **ADMIN** | Control total del sistema, gestión de usuarios y roles |
| **CONTABILIDAD** | Configuración tributaria, precios, impuestos, facturación |
| **COMPRAS** | Alta de terceros proveedores, generación de órdenes de compra |
| **COMERCIAL** | Definición comercial de terceros |
| **CARTERA** | Límites de crédito y condiciones de pago de clientes |
| **BODEGUERO** | Recepción física, datos sanitarios, picking y despacho |
| **DIRECTOR_TECNICO** | Inspección de calidad, liberación o rechazo de lotes |
| **VENDEDOR** | Elaboración de cotizaciones y gestión de pedidos |
| **GERENCIA** | Autorización de excepciones de crédito, auditoría |

Cada endpoint del API valida el rol del usuario autenticado antes de permitir la acción
(ver `backend/src/middleware/auth.js`, función `authorize`).

## Control de auditoría

Toda acción de escritura relevante (crear, actualizar, aprobar, rechazar, bloquear,
autorizar) queda registrada en la tabla `audit_log` con: usuario, rol, acción, entidad
afectada, estado antes/después (JSON), IP y fecha/hora. Los roles `ADMIN` y `GERENCIA`
pueden consultar este log filtrando por entidad, usuario o tipo de acción desde la
pantalla **Auditoría**.

## Procesos implementados (según el documento fuente)

1. **Terceros** (Proveedores y Clientes): captura fiscal, configuración tributaria,
   condiciones comerciales, validación automática de NIT/RUT duplicado.
2. **Compras y Recepción Técnica**: orden de compra → recepción física con formulario
   sanitario obligatorio (lote, vencimiento, registro sanitario, temperatura) →
   bloqueo automático a cuarentena → inspección de calidad → liberación o rechazo.
3. **Cotización y Venta**: cotización con precio/IVA automáticos → validación de
   Registro Sanitario vigente (frena la cotización si no hay lotes vigentes) →
   confirmación a pedido → evaluación de crédito (cupo + mora) → bloqueo con
   posibilidad de override por Clave de Gerencia → asignación FEFO automática
   (primero vence, primero sale) → reserva de inventario.
4. **Picking, Despacho y Facturación**: lista de picking por ubicación/lote →
   confirmación y remisión de salida → factura con liquidación de subtotal + IVA −
   retenciones (según configuración del cliente) → transmisión fiscal simulada
   (CUFE) → descuento definitivo del kardex.

## Instalación y ejecución local

Requisitos: Node.js 18 o superior.

### 1. Backend

```bash
cd backend
cp .env.example .env      # ajustar JWT_SECRET antes de producción
npm install
npm run dev                # arranca en http://localhost:4000
```

Al iniciar por primera vez, el sistema crea automáticamente la base de datos,
los roles, y los siguientes usuarios de prueba:

| Usuario | Contraseña | Rol |
|---|---|---|
| admin | Admin#2026 | Administrador |
| compras | Compras#2026 | Compras |
| bodega | Bodega#2026 | Bodeguero |
| tecnico | Tecnico#2026 | Director Técnico |
| vendedor | Vendedor#2026 | Vendedor |
| gerencia | Gerencia#2026 | Gerencia |
| contabilidad | Contable#2026 | Contabilidad |

**Importante**: cambiar todas estas contraseñas antes de usar el sistema en producción
(desde la pantalla de Usuarios, con la cuenta `admin`).

### 2. Frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev                # arranca en http://localhost:5173
```

Abrir `http://localhost:5173` en el navegador. El frontend ya está configurado
(`vite.config.js`) para redirigir las peticiones `/api/*` al backend en el puerto 4000.

## Despliegue paso a paso (Render + Netlify)

Si no tienes experiencia técnica, sigue la guía **`DESPLIEGUE.md`** incluida en
este mismo paquete: es un paso a paso con capturas de dónde hacer clic para
publicar el sistema en internet usando planes gratuitos (Render para el backend,
Netlify para el frontend).

## Despliegue como SaaS (producción, referencia técnica)

Para que el sistema sea accesible desde cualquier dispositivo por internet:

1. **Backend**: desplegar la carpeta `backend/` en un servidor con Node.js (VPS,
   Render, Railway, un contenedor Docker, etc.). Configurar variables de entorno:
   - `JWT_SECRET`: una cadena larga y aleatoria (no usar la de ejemplo).
   - `PORT`: puerto donde escuchará (por defecto 4000).
   - `DB_PATH`: ruta del archivo SQLite (considerar un volumen persistente si se usa
     un contenedor, o migrar a PostgreSQL para múltiples instancias/alta disponibilidad).
   - Exponer el backend detrás de HTTPS (por ejemplo con un proxy Nginx o el propio
     balanceador del proveedor cloud).

2. **Frontend**: ejecutar `npm run build` dentro de `frontend/`, lo que genera la
   carpeta `frontend/dist/` con archivos estáticos. Esa carpeta se puede alojar en
   cualquier hosting estático (Vercel, Netlify, Nginx, S3+CloudFront, etc.).
   Configurar la variable de entorno de build o el proxy del hosting para que las
   rutas `/api/*` apunten al dominio del backend desplegado.

3. Como toda la lógica vive en el backend y el frontend es solo interfaz, cualquier
   dispositivo con navegador (PC, tablet, celular) que acceda a la URL del frontend
   podrá usar el sistema completo, con la sesión y permisos correspondientes a su
   usuario y rol — esto es lo que da la naturaleza **SaaS multi-dispositivo**.

## Notas sobre el prototipo vs. producción

Este proyecto es un sistema funcional completo y probado (backend + frontend
end-to-end), listo para usarse como base real. Antes de operar con datos reales de
producción se recomienda:

- Cambiar todas las contraseñas de usuarios de prueba.
- Definir un `JWT_SECRET` fuerte y mantenerlo fuera del control de versiones.
- Si se requiere alta concurrencia o múltiples servidores, migrar de SQLite a
  PostgreSQL (la capa `backend/src/db` está aislada para facilitar ese cambio).
- La transmisión a la DIAN (Proceso 4.4) está **simulada** (genera un CUFE de
  ejemplo); para producción debe integrarse con un proveedor tecnológico autorizado
  de facturación electrónica en Colombia.
- Agregar copias de seguridad periódicas de la base de datos.
