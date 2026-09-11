const bcrypt = require("bcryptjs");
const sequelize = require("../config/database");
const env = require("../config/env");
const { Usuario, AuthSession } = require("../models");
const { registrarBitacora } = require("../utils/bitacora");
const { revocarSesionesUsuario } = require("../utils/authSessions");
const {
  generateMfaSecret,
  verifyTotp,
  encryptMfaSecret,
  decryptMfaSecret,
  generateRecoveryCodes,
  hashRecoveryCodes,
  consumeRecoveryCode,
  buildOtpAuthUri,
} = require("../utils/mfa");

const MAX_CODE_LENGTH = 64;

const codeValidInput = (code) =>
  typeof code === "string" &&
  code.trim().length > 0 &&
  code.trim().length <= MAX_CODE_LENGTH;

const recoveryHashesFromUser = (usuario) => {
  try {
    const parsed = JSON.parse(usuario.mfa_recovery_codes || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const verifyFactor = (usuario, code) => {
  if (!usuario.mfa_secret_enc || !codeValidInput(code)) {
    return { ok: false, recoveryHashes: recoveryHashesFromUser(usuario) };
  }

  const secret = decryptMfaSecret(usuario.mfa_secret_enc);
  if (/^\d{6}$/.test(code.trim()) && verifyTotp(secret, code.trim())) {
    return { ok: true, recoveryHashes: recoveryHashesFromUser(usuario) };
  }

  const consumed = consumeRecoveryCode(recoveryHashesFromUser(usuario), code);
  return {
    ok: consumed.matched,
    recoveryHashes: consumed.remaining,
    recoveryUsed: consumed.matched,
  };
};

const status = async (req, res) => {
  const adminRequired = env.REQUIRE_ADMIN_MFA && req.usuario.role === "ADMIN";
  return res.status(200).json({
    enabled: Boolean(req.usuario.mfa_enabled),
    required: Boolean(req.usuario.mfa_enabled) || adminRequired,
    verified: Boolean(req.auth?.mfa_verified),
  });
};

const setup = async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.usuario.id);
    if (!usuario) {
      return res.status(404).json({ mensaje: "Usuario no encontrado" });
    }
    if (usuario.mfa_enabled) {
      return res.status(409).json({ mensaje: "MFA ya está habilitado" });
    }

    const secret = generateMfaSecret();
    await usuario.update({
      mfa_pending_secret_enc: encryptMfaSecret(secret),
    });

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      secret,
      otpauth_uri: buildOtpAuthUri({ email: usuario.email, secret }),
      issuer: env.MFA_ISSUER,
    });
  } catch (error) {
    console.error("Error al preparar MFA:", error);
    return res.status(500).json({ mensaje: "No se pudo preparar MFA" });
  }
};

const confirm = async (req, res) => {
  let transaction;
  try {
    const { code } = req.body || {};
    if (!codeValidInput(code) || !/^\d{6}$/.test(code.trim())) {
      return res.status(400).json({ mensaje: "Código MFA inválido" });
    }

    transaction = await sequelize.transaction();
    const usuario = await Usuario.findByPk(req.usuario.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!usuario?.mfa_pending_secret_enc) {
      await transaction.rollback();
      transaction = null;
      return res.status(409).json({ mensaje: "No hay una configuración MFA pendiente" });
    }

    const secret = decryptMfaSecret(usuario.mfa_pending_secret_enc);
    if (!verifyTotp(secret, code.trim())) {
      await transaction.rollback();
      transaction = null;
      return res.status(401).json({ mensaje: "Código MFA incorrecto" });
    }

    const recoveryCodes = generateRecoveryCodes();
    const recoveryHashes = hashRecoveryCodes(recoveryCodes);

    await usuario.update(
      {
        mfa_enabled: true,
        mfa_secret_enc: usuario.mfa_pending_secret_enc,
        mfa_pending_secret_enc: null,
        mfa_recovery_codes: JSON.stringify(recoveryHashes),
      },
      { transaction },
    );

    await AuthSession.update(
      { mfa_verified_at: new Date() },
      {
        where: {
          id: req.auth.session_id,
          usuario_id: req.usuario.id,
        },
        transaction,
      },
    );

    await transaction.commit();
    transaction = null;

    await registrarBitacora({
      usuario_id: req.usuario.id,
      accion: "MFA_HABILITADO",
      modulo: "AUTH",
      descripcion: "Segundo factor TOTP habilitado",
    });

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      mensaje: "MFA habilitado correctamente",
      recovery_codes: recoveryCodes,
    });
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error("Error al confirmar MFA:", error);
    return res.status(500).json({ mensaje: "No se pudo confirmar MFA" });
  }
};

const verify = async (req, res) => {
  let transaction;
  try {
    const { code } = req.body || {};
    if (!codeValidInput(code)) {
      return res.status(400).json({ mensaje: "Código MFA inválido" });
    }

    transaction = await sequelize.transaction();
    const usuario = await Usuario.findByPk(req.usuario.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!usuario?.mfa_enabled) {
      await transaction.rollback();
      transaction = null;
      return res.status(409).json({ mensaje: "MFA no está habilitado" });
    }

    const result = verifyFactor(usuario, code.trim());
    if (!result.ok) {
      await transaction.rollback();
      transaction = null;
      return res.status(401).json({ mensaje: "Segundo factor inválido" });
    }

    if (result.recoveryUsed) {
      await usuario.update(
        { mfa_recovery_codes: JSON.stringify(result.recoveryHashes) },
        { transaction },
      );
    }

    await AuthSession.update(
      { mfa_verified_at: new Date() },
      {
        where: {
          id: req.auth.session_id,
          usuario_id: req.usuario.id,
        },
        transaction,
      },
    );

    await transaction.commit();
    transaction = null;

    await registrarBitacora({
      usuario_id: req.usuario.id,
      accion: "MFA_VERIFICADO",
      modulo: "AUTH",
      descripcion: result.recoveryUsed
        ? "Segundo factor verificado con código de recuperación"
        : "Segundo factor TOTP verificado",
    });

    return res.status(200).json({ mensaje: "Segundo factor verificado" });
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error("Error al verificar MFA:", error);
    return res.status(500).json({ mensaje: "No se pudo verificar MFA" });
  }
};

const disable = async (req, res) => {
  let transaction;
  try {
    if (env.REQUIRE_ADMIN_MFA && req.usuario.role === "ADMIN") {
      return res.status(409).json({
        mensaje: "MFA es obligatorio para administradores en este entorno",
      });
    }

    const { password, code } = req.body || {};
    if (typeof password !== "string" || !password || !codeValidInput(code)) {
      return res.status(400).json({ mensaje: "Password y segundo factor son obligatorios" });
    }

    transaction = await sequelize.transaction();
    const usuario = await Usuario.findByPk(req.usuario.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!usuario?.mfa_enabled) {
      await transaction.rollback();
      transaction = null;
      return res.status(409).json({ mensaje: "MFA no está habilitado" });
    }

    const passwordOk = await bcrypt.compare(password, usuario.password);
    const factor = verifyFactor(usuario, code.trim());
    if (!passwordOk || !factor.ok) {
      await transaction.rollback();
      transaction = null;
      return res.status(401).json({ mensaje: "Credenciales de confirmación inválidas" });
    }

    await usuario.update(
      {
        mfa_enabled: false,
        mfa_secret_enc: null,
        mfa_pending_secret_enc: null,
        mfa_recovery_codes: null,
      },
      { transaction },
    );

    await revocarSesionesUsuario(usuario.id, { transaction });
    await transaction.commit();
    transaction = null;

    await registrarBitacora({
      usuario_id: req.usuario.id,
      accion: "MFA_DESHABILITADO",
      modulo: "AUTH",
      descripcion: "Segundo factor deshabilitado y sesiones revocadas",
    });

    return res.status(200).json({ mensaje: "MFA deshabilitado correctamente" });
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error("Error al deshabilitar MFA:", error);
    return res.status(500).json({ mensaje: "No se pudo deshabilitar MFA" });
  }
};

module.exports = { status, setup, confirm, verify, disable };
