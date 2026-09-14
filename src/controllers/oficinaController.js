const { Oficina } = require("../models");
const { esAdminGeneral } = require("../utils/permisos");

const listarOficinas = async (req, res) => {
  try {
    const esDireccion = esAdminGeneral(req.usuario);

    const where = {};

    if (!esDireccion) {
      if (!req.usuario.oficina_id) {
        return res.status(400).json({
          mensaje: "El usuario no tiene oficina asignada",
        });
      }

      where.id = req.usuario.oficina_id;
    }

    const oficinas = await Oficina.findAll({
      where,
      order: [["nombre", "ASC"]],
    });

    return res.status(200).json(oficinas);
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al listar oficinas",
      error: error.message,
    });
  }
};

const listarOficinasDestinoDeposito = async (_req, res) => {
  try {
    const oficinas = await Oficina.findAll({
      where: { es_deposito_central: false },
      attributes: ["id", "nombre", "descripcion"],
      order: [["nombre", "ASC"]],
    });

    return res.status(200).json(oficinas);
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al listar oficinas destino del Depósito Central",
      error: error.message,
    });
  }
};

module.exports = {
  listarOficinas,
  listarOficinasDestinoDeposito,
};
