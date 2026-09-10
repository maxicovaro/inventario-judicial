const express = require("express");
const router = express.Router();

const {
  crearPedido,
  listarPedidos,
  actualizarProvision,
  actualizarEstadoPedido,
  exportarPedidoPDF,
} = require("../controllers/pedidoInsumoController");

const {
  verificarToken,
  verificarAdminGeneral,
} = require("../middlewares/authMiddleware");

router.post("/", verificarToken, crearPedido);
router.get("/", verificarToken, listarPedidos);
router.get("/:id/pdf", verificarToken, exportarPedidoPDF);
router.put(
  "/:id/proveer",
  verificarToken,
  verificarAdminGeneral,
  actualizarProvision,
);
router.put(
  "/:id/estado",
  verificarToken,
  verificarAdminGeneral,
  actualizarEstadoPedido,
);

module.exports = router;
