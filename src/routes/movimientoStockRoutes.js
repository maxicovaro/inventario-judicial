const express = require("express");
const router = express.Router();

const {
  listarMovimientosStock,
  crearMovimientoStock,
} = require("../controllers/movimientoStockController");

const { verificarToken, verificarRol } = require("../middlewares/authMiddleware");

router.get(
  "/",
  verificarToken,
  verificarRol("ADMIN"),
  listarMovimientosStock
);

router.post(
  "/",
  verificarToken,
  verificarRol("ADMIN"),
  crearMovimientoStock
);

module.exports = router;