const express = require("express");
const router = express.Router();

const { resumenPedidos } = require("../controllers/reportePedidoController");
const { verificarToken, verificarRol } = require("../middlewares/authMiddleware");

router.get(
  "/resumen",
  verificarToken,
  verificarRol("ADMIN"),
  resumenPedidos
);

module.exports = router;