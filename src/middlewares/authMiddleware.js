const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const env = require("../config/env");
const { Usuario, Role, Oficina, AuthSession } = require("../models");
const { opcionesVerificacionJwt } = require("../config/jwt");
const {
  esAdminGeneral,
  puedeGestionarOficina,
} = require("../utils/permisos");

const MAX_BEARER_TOKEN_LENGTH = 4096;

const crearVerificadorSesion = ({ exigirMfa }) => async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        mensaje: "Acceso denegado. Token no proporcionado",
      });
    }

    if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        mensaje: "Formato de token inválido",
      });
    }

    const token = authHeader.slice(7).trim();

    if (
      !token ||
      token.includes(" ") ||
      token.length > MAX_BEARER_TOKEN_LENGTH
    ) {
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

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET,
      opcionesVerificacionJwt,
    );

    if (!decoded?.id || !decoded?.jti || String(decoded.sub) !== String(decoded.id)) {
      return res.status(401).json({
        mensaje: "Sesión inválida o expirada",
      });
    }

    const sesion = await AuthSession.findOne({
      where: {
        usuario_id: decoded.id,
        jti: decoded.jti,
        revoked_at: { [Op.is]: null },
        expires_at: { [Op.gt]: new Date() },
      },
      attributes: ["id", "jti", "expires_at", "mfa_verified_at"],
    });

    if (!sesion) {
      return res.status(401).json({
        mensaje: "Sesión inválida o expirada",
      });
    }

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

    req.auth = {
      session_id: sesion.id,
      jti: decoded.jti,
      exp: decoded.exp,
      mfa_verified: Boolean(sesion.mfa_verified_at),
      mfa_verified_at: sesion.mfa_verified_at || null,
    };

    req.usuario = {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      role: usuario.Role?.nombre || "",
      role_id: usuario.role_id,
      oficina_id: usuario.oficina_id,
      oficina_nombre: usuario.Oficina?.nombre || "",
      oficina_es_central: Boolean(usuario.Oficina?.es_central),
      mfa_enabled: Boolean(usuario.mfa_enabled),
    };

    const adminMfaRequerido =
      env.REQUIRE_ADMIN_MFA && req.usuario.role === "ADMIN";
    const segundoFactorRequerido =
      req.usuario.mfa_enabled || adminMfaRequerido;

    if (exigirMfa && segundoFactorRequerido && !req.auth.mfa_verified) {
      const codigo = req.usuario.mfa_enabled
        ? "MFA_REQUIRED"
        : "MFA_SETUP_REQUIRED";
      return res.status(403).json({
        codigo,
        mensaje:
          codigo === "MFA_REQUIRED"
            ? "Se requiere segundo factor de autenticación"
            : "Debés configurar MFA antes de continuar",
      });
    }

    next();
  } catch (error) {
    console.warn("Token rechazado:", error.name);
    return res.status(401).json({
      mensaje: "Token inválido o expirado",
    });
  }
};

const verificarToken = crearVerificadorSesion({ exigirMfa: true });
const verificarSesionMfa = crearVerificadorSesion({ exigirMfa: false });

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
  verificarSesionMfa,
  verificarRol,
  permitirRoles,
  verificarAdminGeneral,
  verificarGestionOficina,
};
