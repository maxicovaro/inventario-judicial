const { Bitacora, Usuario } = require("../models");

const listarBitacora = async (req, res) => {
  try {
    const registros = await Bitacora.findAll({
      include: [
        {
          model: Usuario,
          attributes: ["id", "nombre", "apellido", "email"],
        },
      ],
      order: [["id", "DESC"]],
    });

    return res.status(200).json(registros);
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al listar bitácora",
      error: error.message,
    });
  }
};

module.exports = {
  listarBitacora,
};