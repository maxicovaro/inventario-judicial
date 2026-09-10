const express = require("express");
const router = express.Router();

const {
  listarMovimientosStock,
  crearMovimientoStock,
} = require("../controllers/movimientoStockController");

const {
  verificarToken,
  verificarAdminGeneral,
} = require("../middlewares/authMiddleware");

router.get(
  "/",
  verificarToken,
  verificarAdminGeneral,
  listarMovimientosStock,
);

router.post(
  "/",
  verificarToken,
  verificarAdminGeneral,
  crearMovimientoStock,
);

module.exports = router;
