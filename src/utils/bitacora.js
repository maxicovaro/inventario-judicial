const { Bitacora } = require("../models");

const registrarBitacora = async ({
  usuario_id,
  accion,
  modulo,
  descripcion,
}) => {
  try {
    if (!usuario_id || !accion || !modulo) return;

    await Bitacora.create({
      usuario_id,
      accion,
      modulo,
      descripcion: descripcion || null,
      fecha: new Date(),
    });
  } catch (error) {
    console.error("Error al registrar bitácora:", error.message);
  }
};

module.exports = {
  registrarBitacora,
};