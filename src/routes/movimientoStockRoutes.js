const express = require("express");
const router = express.Router();

const {
  listarMovimientosStock,
  crearMovimientoStock,
} = require("../controllers/movimientoStockController");

const { verificarToken } = require("../middlewares/authMiddleware");

router.get("/", verificarToken, listarMovimientosStock);
router.post("/", verificarToken, crearMovimientoStock);

module.exports = router;