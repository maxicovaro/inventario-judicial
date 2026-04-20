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

const alertarStockBajoSiCorresponde = async (insumo) => {
  if (!insumo) return;

  const stockActual = Number(insumo.stock_actual || 0);
  const stockMinimo = Number(insumo.stock_minimo || 0);

  if (stockActual <= stockMinimo) {
    await notificarAdmins({
      titulo: "Alerta de stock bajo",
      mensaje: `El insumo "${insumo.nombre}" quedó con stock bajo. Stock actual: ${stockActual}, stock mínimo: ${stockMinimo}.`,
    });
  }
};

module.exports = {
  crearNotificacion,
  notificarAdmins,
  alertarStockBajoSiCorresponde,
};