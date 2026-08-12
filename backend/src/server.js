require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

require('./db'); // inicializa esquema
require('./db/seed'); // idempotente: crea roles/usuarios/productos si no existen

const authRoutes = require('./routes/auth');
const usuariosRoutes = require('./routes/usuarios');
const tercerosRoutes = require('./routes/terceros');
const productosRoutes = require('./routes/productos');
const comprasRoutes = require('./routes/compras');
const ventasRoutes = require('./routes/ventas');
const despachoRoutes = require('./routes/despacho');
const auditoriaRoutes = require('./routes/auditoria');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('tiny'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', sistema: 'HYD Medical Insumos S.A.S.', hora: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/terceros', tercerosRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/compras', comprasRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/despacho', despachoRoutes);
app.use('/api/auditoria', auditoriaRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.', detalle: err.message });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`HYD Medical Insumos API escuchando en puerto ${PORT}`);
});
