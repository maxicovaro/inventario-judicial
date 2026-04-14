const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Usuario, Role, Oficina } = require('../models');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validaciones básicas
    if (!email || !password) {
      return res.status(400).json({
        mensaje: 'Email y contraseña son obligatorios',
      });
    }

    // Buscar usuario con rol y oficina
    const usuario = await Usuario.findOne({
      where: { email },
      include: [
        { model: Role, attributes: ['id', 'nombre'] },
        { model: Oficina, attributes: ['id', 'nombre'] },
      ],
    });

    if (!usuario) {
      return res.status(401).json({
        mensaje: 'Credenciales inválidas',
      });
    }

    if (!usuario.activo) {
      return res.status(403).json({
        mensaje: 'Usuario inactivo',
      });
    }

    // Comparar contraseña
    const passwordValida = await bcrypt.compare(password, usuario.password);

    if (!passwordValida) {
      return res.status(401).json({
        mensaje: 'Credenciales inválidas',
      });
    }

    // Crear token
    const token = jwt.sign(
      {
        id: usuario.id,
        email: usuario.email,
        role: usuario.Role?.nombre || null,
        oficina_id: usuario.oficina_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.status(200).json({
      mensaje: 'Login exitoso',
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        activo: usuario.activo,
        role: usuario.Role ? usuario.Role.nombre : null,
        oficina: usuario.Oficina ? usuario.Oficina.nombre : null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error interno del servidor',
      error: error.message,
    });
  }
};

module.exports = {
  login,
};