const express = require("express");
const router = express.Router();

const {
  crearPedido,
  listarPedidos,
} = require("../controllers/pedidoInsumoController");

const { verificarToken, verificarRol } = require("../middlewares/authMiddleware");

router.post("/", verificarToken, crearPedido);
router.get("/", verificarToken, verificarRol("ADMIN", "RESPONSABLE"), listarPedidos);

module.exports = router;