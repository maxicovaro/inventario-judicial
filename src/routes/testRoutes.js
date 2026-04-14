const express = require('express');
const router = express.Router();
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

router.get('/privada', verificarToken, (req, res) => {
  res.json({
    mensaje: 'Accediste a una ruta protegida',
    usuario: req.usuario,
  });
});

router.get('/admin', verificarToken, verificarRol('ADMIN'), (req, res) => {
  res.json({
    mensaje: 'Bienvenido, administrador',
    usuario: req.usuario,
  });
});

module.exports = router;