const express = require("express");
const router = express.Router();

const {
  listarActivos,
  obtenerActivo,
  crearActivo,
  actualizarActivo,
  darDeBajaActivo,
} = require("../controllers/activoController");
const {
  listarCatalogoActivos,
} = require("../controllers/activoCatalogoController");

const {
  verificarToken,
  verificarAdminGeneral,
  verificarGestionOficina,
} = require("../middlewares/authMiddleware");

router.get("/", verificarToken, listarActivos);
router.get("/catalogo", verificarToken, listarCatalogoActivos);
router.get("/:id", verificarToken, obtenerActivo);
router.post("/", verificarToken, verificarGestionOficina, crearActivo);
router.put("/:id", verificarToken, verificarGestionOficina, actualizarActivo);
router.patch(
  "/:id/baja",
  verificarToken,
  verificarAdminGeneral,
  darDeBajaActivo,
);

module.exports = router;
