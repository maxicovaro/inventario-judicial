const { MovimientoStock, Insumo, Oficina } = require('../models');

const registrarMovimiento = async (req, res) => {
  try {
    const { insumo_id, tipo, cantidad, motivo, oficina_id } = req.body;

    if (!insumo_id || !tipo || !cantidad) {
      return res.status(400).json({
        mensaje: 'insumo_id, tipo y cantidad son obligatorios',
      });
    }

    const insumo = await Insumo.findByPk(insumo_id);

    if (!insumo) {
      return res.status(404).json({
        mensaje: 'Insumo no encontrado',
      });
    }

    if (tipo === 'EGRESO' && insumo.stock_actual < cantidad) {
      return res.status(400).json({
        mensaje: 'Stock insuficiente',
      });
    }

    if (oficina_id) {
      const oficina = await Oficina.findByPk(oficina_id);
      if (!oficina) {
        return res.status(404).json({
          mensaje: 'Oficina no encontrada',
        });
      }
    }

    let nuevoStock = insumo.stock_actual;

    switch (tipo) {
      case 'INGRESO':
        nuevoStock += cantidad;
        break;
      case 'EGRESO':
        nuevoStock -= cantidad;
        break;
      case 'DEVOLUCION':
        nuevoStock += cantidad;
        break;
      case 'AJUSTE':
        nuevoStock = cantidad;
        break;
    }

    await insumo.update({ stock_actual: nuevoStock });

    const movimiento = await MovimientoStock.create({
      insumo_id,
      tipo,
      cantidad,
      motivo,
      usuario_id: req.usuario.id,
      oficina_id: oficina_id || null,
    });

    return res.status(201).json({
      mensaje: 'Movimiento registrado correctamente',
      movimiento,
      stock_actual: nuevoStock,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al registrar movimiento',
      error: error.message,
    });
  }
};

const listarMovimientos = async (req, res) => {
  try {
    const movimientos = await MovimientoStock.findAll({
      include: [
        { model: Insumo, attributes: ['id', 'nombre'] },
        { model: Oficina, attributes: ['id', 'nombre'] },
      ],
      order: [['id', 'DESC']],
    });

    return res.status(200).json(movimientos);
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al listar movimientos',
      error: error.message,
    });
  }
};

module.exports = {
  registrarMovimiento,
  listarMovimientos,
};