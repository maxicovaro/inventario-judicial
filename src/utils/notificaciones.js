const { Notificacion, Usuario, Role } = require("../models");

const crearNotificacion = async ({ usuario_id, titulo, mensaje }) => {
  if (!usuario_id || !titulo || !mensaje) return;

  await Notificacion.create({
    usuario_id,
    titulo,
    mensaje,
    leida: false,
    fecha: new Date(),
  });
};

const notificarAdmins = async ({ titulo, mensaje }) => {
  const admins = await Usuario.findAll({
    include: [
      {
        model: Role,
        attributes: ["nombre"],
      },
    ],
    where: {
      activo: true,
    },
  });

  const adminsFiltrados = admins.filter((u) => u.Role?.nombre === "ADMIN");

  for (const admin of adminsFiltrados) {
    await crearNotificacion({
      usuario_id: admin.id,
      titulo,
      mensaje,
    });
  }
};

module.exports = {
  crearNotificacion,
  notificarAdmins,
};