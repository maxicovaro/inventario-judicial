const express = require("express");
const router = express.Router();

const {
  listarMovimientos,
  crearMovimiento,
} = require("../controllers/movimientoController");

const {
  verificarToken,
  verificarGestionOficina,
} = require("../middlewares/authMiddleware");

router.get("/", verificarToken, listarMovimientos);
router.post(
  "/",
  verificarToken,
  verificarGestionOficina,
  crearMovimiento,
);

module.exports = router;
