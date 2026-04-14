const express = require('express');
const router = express.Router();

const {
  listarNotificaciones,
  marcarComoLeida,
  contarNoLeidas,
} = require('../controllers/notificacionController');

const { verificarToken } = require('../middlewares/authMiddleware');

router.get('/', verificarToken, listarNotificaciones);
router.get('/no-leidas/count', verificarToken, contarNoLeidas);
router.put('/:id/leida', verificarToken, marcarComoLeida);

module.exports = router;