const express = require('express');
const router = express.Router();

const {
  crearUsuario,
  listarUsuarios,
  obtenerUsuarioPorId,
  actualizarUsuario,
  desactivarUsuario,
} = require('../controllers/usuarioController');

const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

router.get('/', verificarToken, verificarRol('ADMIN'), listarUsuarios);
router.get('/:id', verificarToken, verificarRol('ADMIN'), obtenerUsuarioPorId);
router.post('/', verificarToken, verificarRol('ADMIN'), crearUsuario);
router.put('/:id', verificarToken, verificarRol('ADMIN'), actualizarUsuario);
router.delete('/:id', verificarToken, verificarRol('ADMIN'), desactivarUsuario);

module.exports = router;