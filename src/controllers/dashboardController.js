const { Op, col } = require('sequelize');
const {
  Activo,
  Insumo,
  Usuario,
  Solicitud,
  Movimiento,
  MovimientoStock,
  Oficina,
} = require('../models');

const obtenerDashboard = async (req, res) => {
  try {
    const [
      totalActivos,
      totalInsumos,
      totalUsuariosActivos,
      totalSolicitudesPendientes,
      insumosStockBajo,
      ultimosMovimientosActivos,
      ultimosMovimientosStock,
    ] = await Promise.all([
      Activo.count({
        where: { activo: true },
      }),
      Insumo.count({
        where: { activo: true },
      }),
      Usuario.count({
        where: { activo: true },
      }),
      Solicitud.count({
        where: { estado: 'PENDIENTE' },
      }),
      Insumo.count({
        where: {
          activo: true,
          stock_actual: {
            [Op.lte]: col('stock_minimo'),
          },
        },
      }),
      Movimiento.findAll({
        limit: 5,
        order: [['id', 'DESC']],
        include: [
          {
            model: Activo,
            attributes: ['id', 'nombre', 'codigo_interno'],
          },
          {
            model: Usuario,
            attributes: ['id', 'nombre', 'apellido'],
          },
        ],
      }),
      MovimientoStock.findAll({
        limit: 5,
        order: [['id', 'DESC']],
        include: [
          {
            model: Insumo,
            attributes: ['id', 'nombre'],
          },
          {
            model: Usuario,
            attributes: ['id', 'nombre', 'apellido'],
          },
          {
            model: Oficina,
            attributes: ['id', 'nombre'],
          },
        ],
      }),
    ]);

    return res.status(200).json({
      resumen: {
        total_activos: totalActivos,
        total_insumos: totalInsumos,
        total_usuarios_activos: totalUsuariosActivos,
        total_solicitudes_pendientes: totalSolicitudesPendientes,
        insumos_stock_bajo: insumosStockBajo,
      },
      ultimos_movimientos_activos: ultimosMovimientosActivos,
      ultimos_movimientos_stock: ultimosMovimientosStock,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al obtener dashboard',
      error: error.message,
    });
  }
};

module.exports = {
  obtenerDashboard,
};