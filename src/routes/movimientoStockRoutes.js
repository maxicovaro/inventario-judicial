const express = require("express");
const router = express.Router();

const {
  listarMovimientosStock,
} = require("../controllers/movimientoStockController");

const { verificarToken } = require("../middlewares/authMiddleware");

router.get("/", verificarToken, listarMovimientosStock);

module.exports = router;