const express = require("express");
const router = express.Router();

const {
  listarMovimientos,
  crearMovimiento,
} = require("../controllers/movimientoController");

const { verificarToken } = require("../middlewares/authMiddleware");

router.get("/", verificarToken, listarMovimientos);
router.post("/", verificarToken, crearMovimiento);

module.exports = router;