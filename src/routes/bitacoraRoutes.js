const express = require("express");
const router = express.Router();

const {
  listarBitacora,
  exportarBitacoraExcel,
  exportarBitacoraPDF,
} = require("../controllers/bitacoraController");

const {
  verificarToken,
  verificarAdminGeneral,
} = require("../middlewares/authMiddleware");

router.get("/", verificarToken, verificarAdminGeneral, listarBitacora);
router.get("/excel", verificarToken, verificarAdminGeneral, exportarBitacoraExcel);
router.get("/pdf", verificarToken, verificarAdminGeneral, exportarBitacoraPDF);

module.exports = router;
