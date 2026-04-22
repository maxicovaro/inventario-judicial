const express = require("express");
const router = express.Router();

const { listarBitacora } = require("../controllers/bitacoraController");
const { verificarToken, verificarRol } = require("../middlewares/authMiddleware");

router.get("/", verificarToken, verificarRol("ADMIN"), listarBitacora);

module.exports = router;