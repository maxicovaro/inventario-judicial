const express = require("express");
const router = express.Router();

const {
  listarActivos,
  crearActivo,
  actualizarActivo,
  darDeBajaActivo,
} = require("../controllers/activoController");

const { verificarToken, verificarRol } = require("../middlewares/authMiddleware");

router.get("/", verificarToken, listarActivos);

router.post("/", verificarToken, crearActivo);

router.put("/:id", verificarToken, actualizarActivo);

router.patch(
  "/:id/baja",
  verificarToken,
  verificarRol("ADMIN"),
  darDeBajaActivo
);

module.exports = router;