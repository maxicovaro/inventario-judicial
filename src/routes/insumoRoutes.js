const express = require('express');
const router = express.Router();

const {
  crearInsumo,
  listarInsumos,
  obtenerInsumoPorId,
  actualizarInsumo,
  desactivarInsumo,
  obtenerAlertasStockBajo,
} = require('../controllers/insumoController');

const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

router.get('/', verificarToken, listarInsumos);
router.get('/alertas/stock-bajo', verificarToken, verificarRol('ADMIN', 'RESPONSABLE'), obtenerAlertasStockBajo);
router.get('/:id', verificarToken, obtenerInsumoPorId);
router.post('/', verificarToken, verificarRol('ADMIN', 'RESPONSABLE'), crearInsumo);
router.put('/:id', verificarToken, verificarRol('ADMIN', 'RESPONSABLE'), actualizarInsumo);
router.delete('/:id', verificarToken, verificarRol('ADMIN'), desactivarInsumo);

module.exports = router;