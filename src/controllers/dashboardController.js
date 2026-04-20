const { Op, col, Sequelize } = require("sequelize");
const {
  Activo,
  Insumo,
  Usuario,
  Solicitud,
  Movimiento,
  MovimientoStock,
  Oficina,
  PedidoInsumo,
} = require("../models");

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
      pedidosEnviados,
      pedidosEnRevision,
      pedidosEntregados,
      ultimosPedidos,
      detalleInsumosStockBajo,
      pedidosPorEstadoRaw,
      movimientosStockPorTipoRaw,
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
        where: { estado: "PENDIENTE" },
      }),

      Insumo.count({
        where: {
          activo: true,
          stock_actual: {
            [Op.lte]: col("stock_minimo"),
          },
        },
      }),

      Movimiento.findAll({
        limit: 5,
        order: [["id", "DESC"]],
        include: [
          {
            model: Activo,
            attributes: ["id", "nombre", "codigo_interno"],
          },
          {
            model: Usuario,
            attributes: ["id", "nombre", "apellido"],
          },
        ],
      }),

      MovimientoStock.findAll({
        limit: 5,
        order: [["id", "DESC"]],
        include: [
          {
            model: Insumo,
            attributes: ["id", "nombre"],
          },
          {
            model: Usuario,
            attributes: ["id", "nombre", "apellido"],
          },
          {
            model: Oficina,
            attributes: ["id", "nombre"],
          },
        ],
      }),

      PedidoInsumo.count({
        where: { estado: "ENVIADO" },
      }),

      PedidoInsumo.count({
        where: { estado: "EN_REVISION" },
      }),

      PedidoInsumo.count({
        where: { estado: "ENTREGADO" },
      }),

      PedidoInsumo.findAll({
        limit: 5,
        order: [["id", "DESC"]],
        include: [
          {
            model: Oficina,
            attributes: ["id", "nombre"],
          },
          {
            model: Usuario,
            attributes: ["id", "nombre", "apellido"],
          },
        ],
      }),

      Insumo.findAll({
        where: {
          activo: true,
          stock_actual: {
            [Op.lte]: col("stock_minimo"),
          },
        },
        order: [["stock_actual", "ASC"]],
        limit: 8,
        attributes: [
          "id",
          "nombre",
          "categoria",
          "stock_actual",
          "stock_minimo",
        ],
      }),

      PedidoInsumo.findAll({
        attributes: [
          "estado",
          [Sequelize.fn("COUNT", Sequelize.col("id")), "total"],
        ],
        group: ["estado"],
        raw: true,
      }),

      MovimientoStock.findAll({
        attributes: [
          "tipo",
          [Sequelize.fn("COUNT", Sequelize.col("id")), "total"],
        ],
        group: ["tipo"],
        raw: true,
      }),
    ]);

    const pedidos_por_estado = [
      "ENVIADO",
      "EN_REVISION",
      "APROBADO",
      "ENTREGADO",
      "RECHAZADO",
      "BORRADOR",
    ].map((estado) => {
      const encontrado = pedidosPorEstadoRaw.find((p) => p.estado === estado);
      return {
        estado,
        total: Number(encontrado?.total || 0),
      };
    });

    const movimientos_stock_por_tipo = [
      "INGRESO",
      "EGRESO",
      "AJUSTE",
      "DEVOLUCION",
    ].map((tipo) => {
      const encontrado = movimientosStockPorTipoRaw.find((m) => m.tipo === tipo);
      return {
        tipo,
        total: Number(encontrado?.total || 0),
      };
    });

    return res.status(200).json({
      resumen: {
        total_activos: totalActivos,
        total_insumos: totalInsumos,
        total_usuarios_activos: totalUsuariosActivos,
        total_solicitudes_pendientes: totalSolicitudesPendientes,
        insumos_stock_bajo: insumosStockBajo,
        pedidos_enviados: pedidosEnviados,
        pedidos_en_revision: pedidosEnRevision,
        pedidos_entregados: pedidosEntregados,
      },
      ultimos_movimientos_activos: ultimosMovimientosActivos,
      ultimos_movimientos_stock: ultimosMovimientosStock,
      ultimos_pedidos: ultimosPedidos,
      detalle_insumos_stock_bajo: detalleInsumosStockBajo,
      pedidos_por_estado,
      movimientos_stock_por_tipo,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al obtener dashboard",
      error: error.message,
    });
  }
};

module.exports = {
  obtenerDashboard,
};