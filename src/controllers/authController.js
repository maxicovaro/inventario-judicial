const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sequelize = require("../config/database");
const { Usuario, Role, Oficina, AuthSession } = require("../models");
const { registrarBitacora } = require("../utils/bitacora");
const { revocarSesionPorJti } = require("../utils/authSessions");
const { PASSWORD_BCRYPT_ROUNDS } = require("../utils/passwordPolicy");
const {
  JWT_TTL_SECONDS,
  opcionesFirmaJwt,
} = require("../config/jwt");

const MAX_INTENTOS = 3;
const BLOQUEO_MINUTOS = 15;
const MAX_EMAIL_LENGTH = 150;
const MAX_PASSWORD_INPUT_LENGTH = 256;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  "Dummy#Password2026A",
  PASSWORD_BCRYPT_ROUNDS,
);

const credencialesValidas = (email, password) =>
  typeof email === "string" &&
  typeof password === "string" &&
  email.trim().length > 0 &&
  email.trim().length <= MAX_EMAIL_LENGTH &&
  password.length > 0 &&
  password.length <= MAX_PASSWORD_INPUT_LENGTH;

const registrarEventoAuth = async (evento) => {
  try {
    await registrarBitacora(evento);
  } catch (errorBitacora) {
    console.error("Error al registrar bitácora de autenticación:", errorBitacora);
  }
};

const login = async (req, res) => {
  let transaction;

  try {
    const { email, password } = req.body;

    if (!credencialesValidas(email, password)) {
      return res.status(400).json({ mensaje: "Credenciales con formato inválido" });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET no está configurado");
      return res.status(500).json({ mensaje: "Error interno de autenticación" });
    }

    const emailNormalizado = email.trim().toLowerCase();
    transaction = await sequelize.transaction();

    const usuario = await Usuario.findOne({
      where: { email: emailNormalizado },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!usuario) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      await transaction.rollback();
      transaction = null;
      return res.status(401).json({ mensaje: "Credenciales inválidas" });
    }

    if (usuario.bloqueado_hasta && new Date(usuario.bloqueado_hasta) > new Date()) {
      await transaction.rollback();
      transaction = null;

      await registrarEventoAuth({
        usuario_id: usuario.id,
        accion: "LOGIN_BLOQUEADO",
        modulo: "AUTH",
        descripcion: `Intento de login bloqueado (${usuario.email})`,
      });

      return res.status(403).json({
        mensaje: `Usuario bloqueado hasta ${new Date(usuario.bloqueado_hasta).toLocaleTimeString("es-AR")}`,
      });
    }

    const passwordValida = await bcrypt.compare(password, usuario.password);

    if (!passwordValida) {
      const nuevosIntentos = Number(usuario.intentos_fallidos || 0) + 1;
      const bloqueo =
        nuevosIntentos >= MAX_INTENTOS
          ? new Date(Date.now() + BLOQUEO_MINUTOS * 60 * 1000)
          : null;

      await usuario.update(
        {
          intentos_fallidos: nuevosIntentos,
          bloqueado_hasta: bloqueo,
        },
        { transaction },
      );

      await transaction.commit();
      transaction = null;

      await registrarEventoAuth({
        usuario_id: usuario.id,
        accion: "LOGIN_FALLIDO",
        modulo: "AUTH",
        descripcion: `Intento fallido de login (${usuario.email}) - intento ${nuevosIntentos}/${MAX_INTENTOS}`,
      });

      return res.status(401).json({
        mensaje:
          nuevosIntentos >= MAX_INTENTOS
            ? `Usuario bloqueado por múltiples intentos fallidos durante ${BLOQUEO_MINUTOS} minutos`
            : `Credenciales inválidas (${nuevosIntentos}/${MAX_INTENTOS})`,
      });
    }

    if (!usuario.activo) {
      await transaction.rollback();
      transaction = null;
      return res.status(403).json({ mensaje: "El usuario está inactivo" });
    }

    const [role, oficina] = await Promise.all([
      Role.findByPk(usuario.role_id, {
        attributes: ["id", "nombre"],
        transaction,
      }),
      usuario.oficina_id
        ? Oficina.findByPk(usuario.oficina_id, {
            attributes: ["id", "nombre", "es_central"],
            transaction,
          })
        : null,
    ]);

    const oficinaEsCentral = Boolean(oficina?.es_central);
    const payload = {
      id: usuario.id,
      email: usuario.email,
      role: role?.nombre || "",
      role_id: usuario.role_id,
      oficina_id: usuario.oficina_id,
      oficina_nombre: oficina?.nombre || "",
      oficina_es_central: oficinaEsCentral,
    };

    const jti = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + JWT_TTL_SECONDS * 1000);
    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      opcionesFirmaJwt({ jti, subject: usuario.id }),
    );

    await usuario.update(
      { intentos_fallidos: 0, bloqueado_hasta: null },
      { transaction },
    );

    await AuthSession.create(
      {
        usuario_id: usuario.id,
        jti,
        expires_at: expiresAt,
        revoked_at: null,
      },
      { transaction },
    );

    await transaction.commit();
    transaction = null;

    await registrarEventoAuth({
      usuario_id: usuario.id,
      accion: "LOGIN",
      modulo: "AUTH",
      descripcion: `Login exitoso de ${usuario.email}`,
    });

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        role: role?.nombre || "",
        role_id: usuario.role_id,
        oficina_id: usuario.oficina_id,
        oficina_nombre: oficina?.nombre || "",
        oficina_es_central: oficinaEsCentral,
      },
    });
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }

    console.error("Error en login:", error);
    return res.status(500).json({ mensaje: "Error en login" });
  }
};

const logout = async (req, res) => {
  try {
    await revocarSesionPorJti({
      usuarioId: req.usuario.id,
      jti: req.auth?.jti,
    });

    await registrarEventoAuth({
      usuario_id: req.usuario.id,
      accion: "LOGOUT",
      modulo: "AUTH",
      descripcion: `Cierre de sesión del usuario ID ${req.usuario.id}`,
    });

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ mensaje: "Logout registrado correctamente" });
  } catch (error) {
    console.error("Error al revocar sesión en logout:", error);
    return res.status(500).json({ mensaje: "Error al cerrar sesión" });
  }
};

module.exports = { login, logout };
