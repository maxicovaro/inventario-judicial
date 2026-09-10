const express = require("express");
const router = express.Router();

const {
  listarActivos,
  crearActivo,
  actualizarActivo,
  darDeBajaActivo,
} = require("../controllers/activoController");

const {
  verificarToken,
  verificarAdminGeneral,
  verificarGestionOficina,
} = require("../middlewares/authMiddleware");

router.get("/", verificarToken, listarActivos);
router.post("/", verificarToken, verificarGestionOficina, crearActivo);
router.put("/:id", verificarToken, verificarGestionOficina, actualizarActivo);
router.patch(
  "/:id/baja",
  verificarToken,
  verificarAdminGeneral,
  darDeBajaActivo,
);

module.exports = router;
