const jwt = require("jsonwebtoken");
const { Usuario, Role, Oficina } = require("../models");

const verificarToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        mensaje: "Acceso denegado. Token no proporcionado",
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        mensaje: "Formato de token inválido",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        mensaje: "Token no válido",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        mensaje: "JWT_SECRET no configurado en el servidor",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const usuario = await Usuario.findByPk(decoded.id, {
      include: [
        {
          model: Role,
          attributes: ["id", "nombre"],
        },
        {
          model: Oficina,
          attributes: ["id", "nombre"],
        },
      ],
    });

    if (!usuario) {
      return res.status(401).json({
        mensaje: "Usuario no encontrado o token inválido",
      });
    }

    if (!usuario.activo) {
      return res.status(403).json({
        mensaje: "El usuario está inactivo",
      });
    }

    req.usuario = {
      id: usuario.id,
      email: usuario.email,
      role: usuario.Role?.nombre || "",
      role_id: usuario.role_id,
      oficina_id: usuario.oficina_id,
      oficina_nombre: usuario.Oficina?.nombre || "",
    };

    next();
  } catch (error) {
    return res.status(401).json({
      mensaje: "Token inválido o expirado",
      error: error.message,
    });
  }
};

const verificarRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario || !req.usuario.role) {
      return res.status(403).json({
        mensaje: "Acceso denegado. Rol no identificado",
      });
    }

    if (!rolesPermitidos.includes(req.usuario.role)) {
      return res.status(403).json({
        mensaje: "No tenés permisos para acceder a este recurso",
      });
    }

    next();
  };
};

const permitirRoles = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario || !req.usuario.role) {
      return res.status(403).json({
        mensaje: "Acceso denegado. Rol no identificado",
      });
    }

    if (!rolesPermitidos.includes(req.usuario.role)) {
      return res.status(403).json({
        mensaje: "No tenés permisos para esta acción",
      });
    }

    next();
  };
};

module.exports = {
  verificarToken,
  verificarRol,
  permitirRoles,
};