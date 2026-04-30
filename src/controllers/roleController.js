const { Role } = require("../models");
const { esAdminGeneral } = require("../utils/permisos");

const listarRoles = async (req, res) => {
  try {
    if (!esAdminGeneral(req.usuario)) {
      return res.status(403).json({
        mensaje:
          "Acceso denegado. Solo Dirección de Policía Judicial puede consultar roles.",
      });
    }

    const roles = await Role.findAll({
      order: [["id", "ASC"]],
    });

    return res.status(200).json(roles);
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al listar roles",
      error: error.message,
    });
  }
};

module.exports = {
  listarRoles,
};