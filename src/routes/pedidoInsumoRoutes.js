const express = require("express");
const router = express.Router();

const { crearPedido } = require("../controllers/pedidoCreateController");
const {
  listarPedidos,
  exportarPedidoPDF,
} = require("../controllers/pedidoInsumoController");
const {
  actualizarProvision,
} = require("../controllers/pedidoProvisionController");
const {
  actualizarEstadoPedidoSeguro,
} = require("../controllers/pedidoEstadoController");

const {
  verificarToken,
  verificarAdminGeneral,
} = require("../middlewares/authMiddleware");
const {
  validarEntregaConProvision,
} = require("../middlewares/pedidoProvisionGuard");

router.post("/", verificarToken, crearPedido);
router.get("/", verificarToken, listarPedidos);
router.get("/:id/pdf", verificarToken, exportarPedidoPDF);
router.put(
  "/:id/proveer",
  verificarToken,
  verificarAdminGeneral,
  validarEntregaConProvision,
  actualizarProvision,
);
router.put(
  "/:id/estado",
  verificarToken,
  verificarAdminGeneral,
  actualizarEstadoPedidoSeguro,
);

module.exports = router;
