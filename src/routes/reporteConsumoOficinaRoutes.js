const express = require("express");
const router = express.Router();

const {
  obtenerReporteMensualOficina,
} = require("../controllers/reporteConsumoOficinaController");

const { verificarToken } = require("../middlewares/authMiddleware");

router.get("/consumo-oficina", verificarToken, obtenerReporteMensualOficina);

module.exports = router;