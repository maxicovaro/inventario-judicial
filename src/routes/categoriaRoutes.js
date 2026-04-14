const express = require('express');
const router = express.Router();

const { listarCategorias } = require('../controllers/categoriaController');
const { verificarToken } = require('../middlewares/authMiddleware');

router.get('/', verificarToken, listarCategorias);

module.exports = router;