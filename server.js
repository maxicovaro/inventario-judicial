const express = require("express");
const cors = require("cors");
const env = require("./src/config/env");

const sequelize = require("./src/config/database");
require("./src/models");
const seedInitialData = require("./src/seeders/initialData");
const {
  safeErrorResponses,
  globalErrorHandler,
} = require("./src/middlewares/safeErrorResponses");

const authRoutes = require("./src/routes/authRoutes");
const activoRoutes = require("./src/routes/activoRoutes");
const usuarioRoutes = require("./src/routes/usuarioRoutes");
const solicitudRoutes = require("./src/routes/solicitudRoutes");
const adjuntoRoutes = require("./src/routes/adjuntoRoutes");
const insumoRoutes = require("./src/routes/insumoRoutes");
const movimientoStockRoutes = require("./src/routes/movimientoStockRoutes");
const dashboardRoutes = require("./src/routes/dashboardRoutes");
const oficinaRoutes = require("./src/routes/oficinaRoutes");
const categoriaRoutes = require("./src/routes/categoriaRoutes");
const notificacionRoutes = require("./src/routes/notificacionRoutes");
const stockOficinaRoutes = require("./src/routes/stockOficinaRoutes");
const consumoOficinaRoutes = require("./src/routes/consumoOficinaRoutes");
const reporteConsumoOficinaRoutes = require("./src/routes/reporteConsumoOficinaRoutes");
const pedidoInsumoRoutes = require("./src/routes/pedidoInsumoRoutes");
const reportePedidoRoutes = require("./src/routes/reportePedidoRoutes");
const roleRoutes = require("./src/routes/roleRoutes");
const bitacoraRoutes = require("./src/routes/bitacoraRoutes");

const app = express();

app.use(
  cors({
    origin: env.CORS_ORIGIN,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(safeErrorResponses);

app.get("/", (req, res) => {
  res.json({ mensaje: "Servidor del sistema de inventario funcionando ✓" });
});

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/usuarios", usuarioRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/oficinas", oficinaRoutes);
app.use("/api/categorias", categoriaRoutes);
app.use("/api/bitacora", bitacoraRoutes);
app.use("/api/notificaciones", notificacionRoutes);
app.use("/api/activos", activoRoutes);
app.use("/api/solicitudes", solicitudRoutes);
app.use("/api/adjuntos", adjuntoRoutes);
app.use("/api/insumos", insumoRoutes);
app.use("/api/movimientos-stock", movimientoStockRoutes);
app.use("/api/stock-oficina", stockOficinaRoutes);
app.use("/api/consumo-oficina", consumoOficinaRoutes);
app.use("/api/pedidos", pedidoInsumoRoutes);
app.use("/api/pedidos-insumos", pedidoInsumoRoutes);
app.use("/api/reportes", reporteConsumoOficinaRoutes);
app.use("/api/reportes-pedidos", reportePedidoRoutes);

app.use(globalErrorHandler);

app.use((req, res) => {
  return res.status(404).json({
    mensaje: "Ruta no encontrada",
    ruta: req.originalUrl,
  });
});

sequelize
  .authenticate()
  .then(() => {
    console.log("✓ Conectado a MySQL correctamente");
    return sequelize.sync();
  })
  .then(() => seedInitialData())
  .then(() => {
    app.listen(env.PORT, () => {
      console.log(`✓ Servidor iniciado en ambiente ${env.NODE_ENV}, puerto ${env.PORT}`);
    });
  })
  .catch((error) => {
    console.error("✗ Error al iniciar el servidor:", error);
    process.exitCode = 1;
  });