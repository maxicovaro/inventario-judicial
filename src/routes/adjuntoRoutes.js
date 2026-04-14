const express = require('express');
const router = express.Router();

const {
  subirAdjunto,
  listarAdjuntos,
  descargarAdjunto,
  eliminarAdjunto,
} = require('../controllers/adjuntoController');

const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

router.get('/', verificarToken, listarAdjuntos);
router.get('/:id/download', verificarToken, descargarAdjunto);

router.post(
  '/',
  verificarToken,
  upload.single('archivo'),
  subirAdjunto
);

router.delete(
  '/:id',
  verificarToken,
  verificarRol('ADMIN'),
  eliminarAdjunto
);

module.exports = router;