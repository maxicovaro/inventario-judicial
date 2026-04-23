const express = require("express");
const router = express.Router();

const {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
  desbloquearUsuario,
  resetearPasswordUsuario,
} = require("../controllers/usuarioController");

const { verificarToken, verificarRol } = require("../middlewares/authMiddleware");

router.get("/", verificarToken, verificarRol("ADMIN"), listarUsuarios);
router.post("/", verificarToken, verificarRol("ADMIN"), crearUsuario);
router.put("/:id", verificarToken, verificarRol("ADMIN"), actualizarUsuario);
router.patch(
  "/:id/estado",
  verificarToken,
  verificarRol("ADMIN"),
  cambiarEstadoUsuario,
);
router.patch(
  "/:id/desbloquear",
  verificarToken,
  verificarRol("ADMIN"),
  desbloquearUsuario,
);
router.patch(
  "/:id/reset-password",
  verificarToken,
  verificarRol("ADMIN"),
  resetearPasswordUsuario,
);

module.exports = router;