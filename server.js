const express = require('express');
const cors = require('cors');
require('dotenv').config();

const sequelize = require('./src/config/database');
require('./src/models');
const seedInitialData = require('./src/seeders/initialData');

const app = express();
const authRoutes = require('./src/routes/authRoutes');
const testRoutes = require('./src/routes/testRoutes');
const activoRoutes = require('./src/routes/activoRoutes');
const usuarioRoutes = require('./src/routes/usuarioRoutes');
const solicitudRoutes = require('./src/routes/solicitudRoutes');
const adjuntoRoutes = require('./src/routes/adjuntoRoutes');
const insumoRoutes = require('./src/routes/insumoRoutes');
const movimientoStockRoutes = require('./src/routes/movimientoStockRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const oficinaRoutes = require('./src/routes/oficinaRoutes');
const categoriaRoutes = require('./src/routes/categoriaRoutes');
const notificacionRoutes = require('./src/routes/notificacionRoutes');
const stockOficinaRoutes = require("./src/routes/stockOficinaRoutes");
const consumoOficinaRoutes = require("./src/routes/consumoOficinaRoutes");
const reporteConsumoOficinaRoutes = require("./src/routes/reporteConsumoOficinaRoutes");




app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/test', testRoutes);
app.use('/api/activos', activoRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/solicitudes', solicitudRoutes);
app.use('/api/adjuntos', adjuntoRoutes);
app.use('/api/insumos', insumoRoutes);
app.use('/api/movimientos-stock', movimientoStockRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/oficinas', oficinaRoutes);
app.use('/api/categorias', categoriaRoutes);
app.use('/api/notificaciones', notificacionRoutes);
app.use("/api/pedidos-insumos", require("./src/routes/pedidoInsumoRoutes"));
app.use("/api/reportes-pedidos", require("./src/routes/reportePedidoRoutes"));
app.use("/api/usuarios", require("./src/routes/usuarioRoutes"));
app.use("/api/oficinas", require("./src/routes/oficinaRoutes"));
app.use("/api/roles", require("./src/routes/roleRoutes"));
app.use("/api/bitacora", require("./src/routes/bitacoraRoutes"));
app.use("/api/stock-oficina", stockOficinaRoutes);
app.use("/api/consumo-oficina", consumoOficinaRoutes);
app.use("/api/reportes", reporteConsumoOficinaRoutes);


app.use((error, req, res, next) => {
  if (error) {
    return res.status(400).json({
      mensaje: error.message || 'Error en la carga del archivo',
    });
  }

  next();
});
app.get('/', (req, res) => {
  res.json({ mensaje: 'Servidor del sistema de inventario funcionando ✓' });
});

sequelize.authenticate()
  .then(() => {
    console.log('✓ Conectado a MySQL correctamente');
    return sequelize.sync();
  })
  .then(() => {
    return seedInitialData();
  })
  .then(() => {
    app.listen(process.env.PORT, () => {
      console.log(`✓ Servidor corriendo en http://localhost:${process.env.PORT}`);
    });
  })
  .catch((error) => {
    console.error('✗ Error al conectar:', error.message);
  });