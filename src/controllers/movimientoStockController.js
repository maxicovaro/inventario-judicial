const { MovimientoStock, Insumo, Usuario, Oficina } = require("../models");

const listarMovimientosStock = async (req, res) => {
  try {
    const movimientos = await MovimientoStock.findAll({
      include: [
        { model: Insumo, attributes: ["id", "nombre", "categoria"] },
        { model: Usuario, attributes: ["id", "nombre", "apellido"] },
        { model: Oficina, attributes: ["id", "nombre"] },
      ],
      order: [["fecha", "DESC"]],
    });

    return res.status(200).json(movimientos);
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al listar movimientos de stock",
      error: error.message,
    });
  }
};

module.exports = {
  listarMovimientosStock,
};