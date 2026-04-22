const express = require("express");
const router = express.Router();

const {
  listarInsumos,
  crearInsumo,
  actualizarInsumo,
} = require("../controllers/insumoController");

const { verificarToken } = require("../middlewares/authMiddleware");

router.get("/", verificarToken, listarInsumos);
router.post("/", verificarToken, crearInsumo);
router.put("/:id", verificarToken, actualizarInsumo);

module.exports = router;