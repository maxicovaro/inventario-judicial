const { Insumo } = require('../models');
const { Op, where, col } = require('sequelize');

const crearInsumo = async (req, res) => {
  try {
    const {
      nombre,
      descripcion,
      categoria,
      unidad_medida,
      stock_actual,
      stock_minimo,
      lote,
      fecha_vencimiento,
      proveedor,
      observaciones,
    } = req.body;

    if (!nombre) {
      return res.status(400).json({
        mensaje: 'El nombre del insumo es obligatorio',
      });
    }

    const nuevoInsumo = await Insumo.create({
      nombre,
      descripcion,
      categoria,
      unidad_medida,
      stock_actual,
      stock_minimo,
      lote,
      fecha_vencimiento,
      proveedor,
      observaciones,
      activo: true,
    });

    return res.status(201).json({
      mensaje: 'Insumo creado correctamente',
      insumo: nuevoInsumo,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al crear insumo',
      error: error.message,
    });
  }
};

const listarInsumos = async (req, res) => {
  try {
    const { stock_bajo } = req.query;

    const where = { activo: true };
    const insumos = await Insumo.findAll({
      where,
      order: [['id', 'DESC']],
    });

    if (stock_bajo === 'true') {
      const filtrados = insumos.filter(i => i.stock_actual <= i.stock_minimo);
      return res.status(200).json(filtrados);
    }

    return res.status(200).json(insumos);
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al listar insumos',
      error: error.message,
    });
  }
};
const obtenerAlertasStockBajo = async (req, res) => {
  try {
    const insumos = await Insumo.findAll({
      where: {
        activo: true,
        stock_actual: {
          [Op.lte]: col('stock_minimo'),
        },
      },
      order: [['stock_actual', 'ASC']],
    });

    return res.status(200).json({
      total: insumos.length,
      insumos,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al obtener alertas de stock bajo',
      error: error.message,
    });
  }
};
const obtenerInsumoPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const insumo = await Insumo.findByPk(id);

    if (!insumo) {
      return res.status(404).json({
        mensaje: 'Insumo no encontrado',
      });
    }

    return res.status(200).json(insumo);
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al obtener insumo',
      error: error.message,
    });
  }
};

const actualizarInsumo = async (req, res) => {
  try {
    const { id } = req.params;
    const insumo = await Insumo.findByPk(id);

    if (!insumo) {
      return res.status(404).json({
        mensaje: 'Insumo no encontrado',
      });
    }

    await insumo.update(req.body);

    return res.status(200).json({
      mensaje: 'Insumo actualizado correctamente',
      insumo,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al actualizar insumo',
      error: error.message,
    });
  }
};

const desactivarInsumo = async (req, res) => {
  try {
    const { id } = req.params;
    const insumo = await Insumo.findByPk(id);

    if (!insumo) {
      return res.status(404).json({
        mensaje: 'Insumo no encontrado',
      });
    }

    await insumo.update({ activo: false });

    return res.status(200).json({
      mensaje: 'Insumo desactivado correctamente',
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al desactivar insumo',
      error: error.message,
    });
  }
};

module.exports = {
  crearInsumo,
  listarInsumos,
  obtenerInsumoPorId,
  actualizarInsumo,
  desactivarInsumo,
  obtenerAlertasStockBajo,
};