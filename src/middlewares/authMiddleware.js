const jwt = require('jsonwebtoken');

const verificarToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        mensaje: 'Acceso denegado. Token no proporcionado',
      });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        mensaje: 'Formato de token inválido',
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        mensaje: 'Token no válido',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.usuario = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      mensaje: 'Token inválido o expirado',
      error: error.message,
    });
  }
};

const verificarRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario || !req.usuario.role) {
      return res.status(403).json({
        mensaje: 'Acceso denegado. Rol no identificado',
      });
    }

    if (!rolesPermitidos.includes(req.usuario.role)) {
      return res.status(403).json({
        mensaje: 'No tenés permisos para acceder a este recurso',
      });
    }

    next();
  };
};

module.exports = {
  verificarToken,
  verificarRol,
};