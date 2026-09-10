const { Op } = require("sequelize");
const { AuthSession } = require("../models");

const revocarSesionesUsuario = async (usuarioId, options = {}) => {
  const transaction = options.transaction;
  const ahora = new Date();

  const [cantidad] = await AuthSession.update(
    { revoked_at: ahora },
    {
      where: {
        usuario_id: usuarioId,
        revoked_at: { [Op.is]: null },
      },
      transaction,
    },
  );

  return cantidad;
};

const revocarSesionPorJti = async ({ usuarioId, jti, transaction }) => {
  if (!jti) return 0;

  const [cantidad] = await AuthSession.update(
    { revoked_at: new Date() },
    {
      where: {
        usuario_id: usuarioId,
        jti,
        revoked_at: { [Op.is]: null },
      },
      transaction,
    },
  );

  return cantidad;
};

module.exports = {
  revocarSesionesUsuario,
  revocarSesionPorJti,
};
