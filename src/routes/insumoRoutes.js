const express = require("express");
const router = express.Router();

const {
  listarInsumos,
  crearInsumo,
  actualizarInsumo,
} = require("../controllers/insumoController");

const {
  verificarToken,
  verificarAdminGeneral,
} = require("../middlewares/authMiddleware");

router.get("/", verificarToken, listarInsumos);

router.post(
  "/",
  verificarToken,
  verificarAdminGeneral,
  crearInsumo,
);

router.put(
  "/:id",
  verificarToken,
  verificarAdminGeneral,
  actualizarInsumo,
);

module.exports = router;
