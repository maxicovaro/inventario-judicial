const express = require('express');
const router = express.Router();

const {
  crearActivo,
  listarActivos,
  obtenerActivoPorId,
  actualizarActivo,
  eliminarActivo,
} = require('../controllers/activoController');

const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

router.get('/', verificarToken, listarActivos);
router.get('/:id', verificarToken, obtenerActivoPorId);
router.post('/', verificarToken, verificarRol('ADMIN', 'RESPONSABLE'), crearActivo);
router.put('/:id', verificarToken, verificarRol('ADMIN', 'RESPONSABLE'), actualizarActivo);
router.delete('/:id', verificarToken, verificarRol('ADMIN'), eliminarActivo);

module.exports = router;