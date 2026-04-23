const express = require("express");
const router = express.Router();

const {
  listarBitacora,
  exportarBitacoraExcel,
  exportarBitacoraPDF,
} = require("../controllers/bitacoraController");

const { verificarToken, verificarRol } = require("../middlewares/authMiddleware");

router.get("/", verificarToken, verificarRol("ADMIN"), listarBitacora);
router.get("/excel", verificarToken, verificarRol("ADMIN"), exportarBitacoraExcel);
router.get("/pdf", verificarToken, verificarRol("ADMIN"), exportarBitacoraPDF);

module.exports = router;