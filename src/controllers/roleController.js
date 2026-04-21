const { Role } = require("../models");

const listarRoles = async (req, res) => {
  try {
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