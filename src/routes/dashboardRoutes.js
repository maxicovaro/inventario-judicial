const express = require('express');
const router = express.Router();

const { obtenerDashboard } = require('../controllers/dashboardController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

router.get('/', verificarToken, verificarRol('ADMIN', 'RESPONSABLE'), obtenerDashboard);

module.exports = router;