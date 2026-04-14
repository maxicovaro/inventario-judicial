const { Categoria } = require('../models');

const listarCategorias = async (req, res) => {
  try {
    const categorias = await Categoria.findAll({
      order: [['nombre', 'ASC']],
    });

    return res.status(200).json(categorias);
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al listar categorías',
      error: error.message,
    });
  }
};

module.exports = {
  listarCategorias,
};