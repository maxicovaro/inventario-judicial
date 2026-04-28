const express = require("express");
const router = express.Router();

const {
  obtenerStockPorOficina,
  asignarStockAOficina,
} = require("../controllers/stockOficinaController");

const { verificarToken, verificarRol } = require("../middlewares/authMiddleware");

router.get("/:oficina_id", verificarToken, obtenerStockPorOficina);

router.post(
  "/asignar",
  verificarToken,
  verificarRol("ADMIN"),
  asignarStockAOficina,
);

module.exports = router;