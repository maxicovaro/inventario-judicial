const jwt = require("jsonwebtoken");
const { Usuario, Role, Oficina } = require("../models");
const {
  esAdminGeneral,
  puedeGestionarOficina,
} = require("../utils/permisos");

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
      console.error("JWT_SECRET no está configurado");
      return res.status(500).json({
        mensaje: "Error interno de autenticación",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const usuario = await Usuario.findByPk(decoded.id, {
      include: [
        { model: Role, attributes: ["id", "nombre"] },
        { model: Oficina, attributes: ["id", "nombre", "es_central"] },
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
      oficina_es_central: Boolean(usuario.Oficina?.es_central),
    };

    next();
  } catch (error) {
    console.warn("Token rechazado:", error.name);
    return res.status(401).json({
      mensaje: "Token inválido o expirado",
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

const verificarAdminGeneral = (req, res, next) => {
  if (!esAdminGeneral(req.usuario)) {
    return res.status(403).json({
      mensaje: "Acceso denegado. Se requiere permiso de Administrador General",
    });
  }

  next();
};

const verificarGestionOficina = (req, res, next) => {
  if (!puedeGestionarOficina(req.usuario)) {
    return res.status(403).json({
      mensaje: "Acceso denegado. Se requiere ser Administrador General o RESPONSABLE de una oficina",
    });
  }

  next();
};

module.exports = {
  verificarToken,
  verificarRol,
  permitirRoles,
  verificarAdminGeneral,
  verificarGestionOficina,
};
