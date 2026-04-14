const express = require('express');
const router = express.Router();

const { listarOficinas } = require('../controllers/oficinaController');
const { verificarToken } = require('../middlewares/authMiddleware');

router.get('/', verificarToken, listarOficinas);

module.exports = router;