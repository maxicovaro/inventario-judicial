const express = require("express");
const router = express.Router();

const { crearPedido } = require("../controllers/pedidoCreateController");
const {
  listarPedidos,
  actualizarProvision,
  exportarPedidoPDF,
} = require("../controllers/pedidoInsumoController");
const {
  actualizarEstadoPedidoSeguro,
} = require("../controllers/pedidoEstadoController");

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
  actualizarEstadoPedidoSeguro,
);

module.exports = router;
