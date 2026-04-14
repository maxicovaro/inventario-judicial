const express = require('express');
const router = express.Router();

const {
  registrarMovimiento,
  listarMovimientos,
} = require('../controllers/movimientoStockController');

const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

router.get('/', verificarToken, listarMovimientos);

router.post(
  '/',
  verificarToken,
  verificarRol('ADMIN', 'RESPONSABLE'),
  registrarMovimiento
);

module.exports = router;