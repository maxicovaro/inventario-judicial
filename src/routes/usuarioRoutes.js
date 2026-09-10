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

const {
  verificarToken,
  verificarAdminGeneral,
} = require("../middlewares/authMiddleware");

router.get("/", verificarToken, verificarAdminGeneral, listarUsuarios);
router.post("/", verificarToken, verificarAdminGeneral, crearUsuario);
router.put("/:id", verificarToken, verificarAdminGeneral, actualizarUsuario);
router.patch(
  "/:id/estado",
  verificarToken,
  verificarAdminGeneral,
  cambiarEstadoUsuario,
);
router.patch(
  "/:id/desbloquear",
  verificarToken,
  verificarAdminGeneral,
  desbloquearUsuario,
);
router.patch(
  "/:id/reset-password",
  verificarToken,
  verificarAdminGeneral,
  resetearPasswordUsuario,
);

module.exports = router;
