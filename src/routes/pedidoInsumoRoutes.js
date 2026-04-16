const express = require("express");
const router = express.Router();

const {
  crearPedido,
  listarPedidos,
  actualizarProvision,
  actualizarEstadoPedido,
  exportarPedidoPDF,
} = require("../controllers/pedidoInsumoController");

const { verificarToken, verificarRol } = require("../middlewares/authMiddleware");

router.post("/", verificarToken, crearPedido);
router.get("/", verificarToken, listarPedidos);
router.get("/:id/pdf", verificarToken, exportarPedidoPDF);
router.put(
  "/:id/proveer",
  verificarToken,
  verificarRol("ADMIN"),
  actualizarProvision
);
router.put(
  "/:id/estado",
  verificarToken,
  verificarRol("ADMIN"),
  actualizarEstadoPedido
);

module.exports = router;