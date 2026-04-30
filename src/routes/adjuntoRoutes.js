const express = require("express");
const router = express.Router();

const {
  subirAdjunto,
  listarAdjuntos,
  descargarAdjunto,
  eliminarAdjunto,
} = require("../controllers/adjuntoController");

const { verificarToken } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");

router.get("/", verificarToken, listarAdjuntos);

router.post(
  "/",
  verificarToken,
  upload.single("archivo"),
  subirAdjunto
);

router.get("/:id/download", verificarToken, descargarAdjunto);

router.delete("/:id", verificarToken, eliminarAdjunto);

module.exports = router;