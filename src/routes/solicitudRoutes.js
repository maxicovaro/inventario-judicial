const express = require('express');
const router = express.Router();

const {
  crearSolicitud,
  listarSolicitudes,
  obtenerSolicitudPorId,
  actualizarSolicitud,
  eliminarSolicitud,
} = require('../controllers/solicitudController');

const { verificarToken } = require('../middlewares/authMiddleware');

router.get('/', verificarToken, listarSolicitudes);
router.get('/:id', verificarToken, obtenerSolicitudPorId);
router.post('/', verificarToken, crearSolicitud);
router.put('/:id', verificarToken, actualizarSolicitud);
router.delete('/:id', verificarToken, eliminarSolicitud);

module.exports = router;