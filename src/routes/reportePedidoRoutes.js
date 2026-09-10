const express = require("express");
const router = express.Router();

const {
  resumenPedidos,
  exportarResumenPedidosPDF,
} = require("../controllers/reportePedidoController");

const {
  verificarToken,
  verificarAdminGeneral,
} = require("../middlewares/authMiddleware");

router.get(
  "/resumen",
  verificarToken,
  verificarAdminGeneral,
  resumenPedidos,
);

router.get(
  "/resumen/pdf",
  verificarToken,
  verificarAdminGeneral,
  exportarResumenPedidosPDF,
);

module.exports = router;
