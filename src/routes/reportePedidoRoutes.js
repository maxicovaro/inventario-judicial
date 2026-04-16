const express = require("express");
const router = express.Router();

const {
  resumenPedidos,
  exportarResumenPedidosPDF,
} = require("../controllers/reportePedidoController");

const { verificarToken, verificarRol } = require("../middlewares/authMiddleware");

router.get(
  "/resumen",
  verificarToken,
  verificarRol("ADMIN"),
  resumenPedidos
);

router.get(
  "/resumen/pdf",
  verificarToken,
  verificarRol("ADMIN"),
  exportarResumenPedidosPDF
);

module.exports = router;