const express = require("express");
const router = express.Router();

const {
  listarInsumos,
  crearInsumo,
  actualizarInsumo,
} = require("../controllers/insumoController");

const { verificarToken, verificarRol } = require("../middlewares/authMiddleware");

router.get("/", verificarToken, listarInsumos);

router.post(
  "/",
  verificarToken,
  verificarRol("ADMIN"),
  crearInsumo
);

router.put(
  "/:id",
  verificarToken,
  verificarRol("ADMIN"),
  actualizarInsumo
);

module.exports = router;