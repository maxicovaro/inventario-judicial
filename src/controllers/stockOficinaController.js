const {
  StockOficina,
  Insumo,
  Oficina,
  MovimientoStock,
} = require("../models");

const { registrarBitacora } = require("../utils/bitacora");
const { alertarStockBajoSiCorresponde } = require("../utils/notificaciones");

const obtenerStockPorOficina = async (req, res) => {
  try {
    const { oficina_id } = req.params;

    const stock = await StockOficina.findAll({
      where: { oficina_id },
      include: [
        {
          model: Insumo,
          attributes: ["id", "nombre", "categoria", "unidad_medida"],
        },
        {
          model: Oficina,
          attributes: ["id", "nombre"],
        },
      ],
      order: [[Insumo, "nombre", "ASC"]],
    });

    return res.status(200).json(stock);
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al obtener stock por oficina",
      error: error.message,
    });
  }
};

const asignarStockAOficina = async (req, res) => {
  try {
    const { insumo_id, oficina_id, cantidad, motivo } = req.body;

    if (!insumo_id || !oficina_id || !cantidad) {
      return res.status(400).json({
        mensaje: "Insumo, oficina y cantidad son obligatorios",
      });
    }

    const cantidadNum = Number(cantidad);

    if (!Number.isInteger(cantidadNum) || cantidadNum <= 0) {
      return res.status(400).json({
        mensaje: "La cantidad debe ser un número entero mayor a 0",
      });
    }

    const insumo = await Insumo.findByPk(insumo_id);

    if (!insumo) {
      return res.status(404).json({
        mensaje: "Insumo no encontrado",
      });
    }

    const oficina = await Oficina.findByPk(oficina_id);

    if (!oficina) {
      return res.status(404).json({
        mensaje: "Oficina no encontrada",
      });
    }

    if (Number(insumo.stock_actual) < cantidadNum) {
      return res.status(400).json({
        mensaje: `Stock insuficiente en depósito central para "${insumo.nombre}". Disponible: ${insumo.stock_actual}`,
      });
    }

    await insumo.update({
      stock_actual: Number(insumo.stock_actual) - cantidadNum,
    });

    const [stockOficina] = await StockOficina.findOrCreate({
      where: {
        insumo_id: insumo.id,
        oficina_id: oficina.id,
      },
      defaults: {
        insumo_id: insumo.id,
        oficina_id: oficina.id,
        cantidad: 0,
      },
    });

    await stockOficina.update({
      cantidad: Number(stockOficina.cantidad) + cantidadNum,
    });

    await MovimientoStock.create({
      insumo_id: insumo.id,
      tipo: "EGRESO",
      cantidad: cantidadNum,
      motivo:
        motivo ||
        `Asignación manual de stock a ${oficina.nombre}`,
      usuario_id: req.usuario.id,
      oficina_id: oficina.id,
    });

    await insumo.reload();
    await alertarStockBajoSiCorresponde(insumo);

    await registrarBitacora({
      usuario_id: req.usuario.id,
      accion: "ASIGNAR_STOCK",
      modulo: "STOCK_OFICINA",
      descripcion: `Asignó ${cantidadNum} unidad(es) de "${insumo.nombre}" a ${oficina.nombre}`,
    });

    return res.status(200).json({
      mensaje: "Stock asignado correctamente a la oficina",
      stockOficina,
    });
  } catch (error) {
    console.error("ERROR asignarStockAOficina:", error);

    return res.status(500).json({
      mensaje: "Error al asignar stock a oficina",
      error: error.message,
    });
  }
};

module.exports = {
  obtenerStockPorOficina,
  asignarStockAOficina,
};