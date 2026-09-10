const express = require("express");
const cors = require("cors");
const env = require("./config/env");
const { requestContext } = require("./middlewares/requestContext");
const { securityHeaders } = require("./middlewares/securityHeaders");
const {
  safeErrorResponses,
  globalErrorHandler,
} = require("./middlewares/safeErrorResponses");

const healthRoutes = require("./routes/healthRoutes");
const authRoutes = require("./routes/authRoutes");
const activoRoutes = require("./routes/activoRoutes");
const movimientoRoutes = require("./routes/movimientoRoutes");
const usuarioRoutes = require("./routes/usuarioRoutes");
const solicitudRoutes = require("./routes/solicitudRoutes");
const adjuntoRoutes = require("./routes/adjuntoRoutes");
const insumoRoutes = require("./routes/insumoRoutes");
const movimientoStockRoutes = require("./routes/movimientoStockRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const oficinaRoutes = require("./routes/oficinaRoutes");
const categoriaRoutes = require("./routes/categoriaRoutes");
const notificacionRoutes = require("./routes/notificacionRoutes");
const stockOficinaRoutes = require("./routes/stockOficinaRoutes");
const consumoOficinaRoutes = require("./routes/consumoOficinaRoutes");
const reporteConsumoOficinaRoutes = require("./routes/reporteConsumoOficinaRoutes");
const pedidoInsumoRoutes = require("./routes/pedidoInsumoRoutes");
const reportePedidoRoutes = require("./routes/reportePedidoRoutes");
const roleRoutes = require("./routes/roleRoutes");
const bitacoraRoutes = require("./routes/bitacoraRoutes");

const app = express();

app.disable("x-powered-by");
app.use(requestContext);
app.use(securityHeaders);
app.use(
  cors({
    origin: env.CORS_ORIGIN,
  }),
);
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(safeErrorResponses);

app.get("/", (req, res) => {
  res.json({ mensaje: "Servidor del sistema de inventario funcionando ✓" });
});

app.use("/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/usuarios", usuarioRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/oficinas", oficinaRoutes);
app.use("/api/categorias", categoriaRoutes);
app.use("/api/bitacora", bitacoraRoutes);
app.use("/api/notificaciones", notificacionRoutes);
app.use("/api/activos", activoRoutes);
app.use("/api/movimientos", movimientoRoutes);
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

app.use((req, res) => {
  return res.status(404).json({
    mensaje: "Ruta no encontrada",
    ruta: req.originalUrl,
  });
});

app.use(globalErrorHandler);

module.exports = app;
