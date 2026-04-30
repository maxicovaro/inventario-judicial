const express = require("express");
const cors = require("cors");
require("dotenv").config();

const sequelize = require("./src/config/database");
require("./src/models");
const seedInitialData = require("./src/seeders/initialData");

const authRoutes = require("./src/routes/authRoutes");
const testRoutes = require("./src/routes/testRoutes");
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

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.json({
    mensaje: "Servidor del sistema de inventario funcionando ✓",
  });
});

// AUTH
app.use("/api/auth", authRoutes);

// TEST
app.use("/api/test", testRoutes);

// SISTEMA
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/usuarios", usuarioRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/oficinas", oficinaRoutes);
app.use("/api/categorias", categoriaRoutes);
app.use("/api/bitacora", bitacoraRoutes);
app.use("/api/notificaciones", notificacionRoutes);

// ACTIVOS / SOLICITUDES / ADJUNTOS
app.use("/api/activos", activoRoutes);
app.use("/api/solicitudes", solicitudRoutes);
app.use("/api/adjuntos", adjuntoRoutes);

// INSUMOS / STOCK / CONSUMO
app.use("/api/insumos", insumoRoutes);
app.use("/api/movimientos-stock", movimientoStockRoutes);
app.use("/api/stock-oficina", stockOficinaRoutes);
app.use("/api/consumo-oficina", consumoOficinaRoutes);

// PEDIDOS MENSUALES
app.use("/api/pedidos", pedidoInsumoRoutes);

// Alias temporal para no romper pantallas viejas si alguna todavía usa esta ruta
app.use("/api/pedidos-insumos", pedidoInsumoRoutes);

// REPORTES
app.use("/api/reportes", reporteConsumoOficinaRoutes);
app.use("/api/reportes-pedidos", reportePedidoRoutes);

// MANEJO DE ERRORES DE MULTER / UPLOADS
app.use((error, req, res, next) => {
  if (error) {
    return res.status(400).json({
      mensaje: error.message || "Error en la carga del archivo",
    });
  }

  next();
});

// RUTA NO ENCONTRADA
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
  .then(() => {
    return seedInitialData();
  })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✓ Servidor corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("✗ Error al conectar:", error.message);
  });