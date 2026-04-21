const express = require("express");
const router = express.Router();

const {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
} = require("../controllers/usuarioController");

const { verificarToken, verificarRol } = require("../middlewares/authMiddleware");

router.get("/", verificarToken, verificarRol("ADMIN"), listarUsuarios);
router.post("/", verificarToken, verificarRol("ADMIN"), crearUsuario);
router.put("/:id", verificarToken, verificarRol("ADMIN"), actualizarUsuario);
router.patch(
  "/:id/estado",
  verificarToken,
  verificarRol("ADMIN"),
  cambiarEstadoUsuario
);

module.exports = router;