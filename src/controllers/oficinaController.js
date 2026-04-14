const { Oficina } = require('../models');

const listarOficinas = async (req, res) => {
  try {
    const oficinas = await Oficina.findAll({
      order: [['nombre', 'ASC']],
    });

    return res.status(200).json(oficinas);
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al listar oficinas',
      error: error.message,
    });
  }
};

module.exports = {
  listarOficinas,
};