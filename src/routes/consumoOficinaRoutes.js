const express = require("express");
const router = express.Router();

const {
  registrarConsumoOficina,
  listarConsumosOficina,
  obtenerResumenConsumoPorOficina,
} = require("../controllers/consumoOficinaController");

const { verificarToken } = require("../middlewares/authMiddleware");

router.post("/", verificarToken, registrarConsumoOficina);

router.get("/", verificarToken, listarConsumosOficina);

router.get(
  "/resumen/:oficina_id",
  verificarToken,
  obtenerResumenConsumoPorOficina,
);

module.exports = router;