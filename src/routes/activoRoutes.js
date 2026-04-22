const express = require("express");
const router = express.Router();

const {
  listarActivos,
  crearActivo,
  actualizarActivo,
} = require("../controllers/activoController");

const { verificarToken } = require("../middlewares/authMiddleware");

router.get("/", verificarToken, listarActivos);
router.post("/", verificarToken, crearActivo);
router.put("/:id", verificarToken, actualizarActivo);

module.exports = router;