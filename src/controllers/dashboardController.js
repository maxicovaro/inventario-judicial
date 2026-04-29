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
  StockOficina,
} = require("../models");

const { esAdminGeneral } = require("../utils/permisos");

const ESTADOS_PEDIDO = [
  "ENVIADO",
  "EN_REVISION",
  "APROBADO",
  "ENTREGADO",
  "RECHAZADO",
  "BORRADOR",
];

const TIPOS_MOVIMIENTO_STOCK = ["INGRESO", "EGRESO", "AJUSTE", "DEVOLUCION"];

const obtenerDashboard = async (req, res) => {
  try {
    const esDireccion = esAdminGeneral(req.usuario);
    const oficinaId = req.usuario?.oficina_id || null;

    if (!esDireccion && !oficinaId) {
      return res.status(403).json({
        mensaje: "El usuario no tiene oficina asignada",
      });
    }

    const wherePedidos = esDireccion ? {} : { oficina_id: oficinaId };
    const whereMovimientoStock = esDireccion ? {} : { oficina_id: oficinaId };
    const whereActivos = esDireccion
      ? { activo: true }
      : { activo: true, oficina_id: oficinaId };

    let totalActivos = 0;
    let totalInsumos = 0;
    let totalUsuariosActivos = 0;
    let totalSolicitudesPendientes = 0;
    let insumosStockBajo = 0;
    let ultimosMovimientosActivos = [];
    let ultimosMovimientosStock = [];
    let pedidosEnviados = 0;
    let pedidosEnRevision = 0;
    let pedidosEntregados = 0;
    let ultimosPedidos = [];
    let detalleInsumosStockBajo = [];
    let pedidosPorEstadoRaw = [];
    let movimientosStockPorTipoRaw = [];

    if (esDireccion) {
      [
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
          where: whereActivos,
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
    } else {
      [
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
          where: whereActivos,
        }),

        StockOficina.count({
          where: {
            oficina_id: oficinaId,
          },
        }),

        Usuario.count({
          where: {
            activo: true,
            oficina_id: oficinaId,
          },
        }),

        Solicitud.count({
          where: {
            estado: "PENDIENTE",
            oficina_id: oficinaId,
          },
        }),

        StockOficina.count({
          where: {
            oficina_id: oficinaId,
            cantidad: {
              [Op.lte]: 0,
            },
          },
        }),

        Movimiento.findAll({
          limit: 5,
          order: [["id", "DESC"]],
          include: [
            {
              model: Activo,
              where: {
                oficina_id: oficinaId,
              },
              attributes: ["id", "nombre", "codigo_interno"],
            },
            {
              model: Usuario,
              attributes: ["id", "nombre", "apellido"],
            },
          ],
        }),

        MovimientoStock.findAll({
          where: whereMovimientoStock,
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
          where: {
            ...wherePedidos,
            estado: "ENVIADO",
          },
        }),

        PedidoInsumo.count({
          where: {
            ...wherePedidos,
            estado: "EN_REVISION",
          },
        }),

        PedidoInsumo.count({
          where: {
            ...wherePedidos,
            estado: "ENTREGADO",
          },
        }),

        PedidoInsumo.findAll({
          where: wherePedidos,
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

        StockOficina.findAll({
          where: {
            oficina_id: oficinaId,
            cantidad: {
              [Op.lte]: 0,
            },
          },
          include: [
            {
              model: Insumo,
              attributes: [
                "id",
                "nombre",
                "categoria",
                "unidad_medida",
                "stock_minimo",
              ],
            },
          ],
          order: [["cantidad", "ASC"]],
          limit: 8,
        }),

        PedidoInsumo.findAll({
          attributes: [
            "estado",
            [Sequelize.fn("COUNT", Sequelize.col("id")), "total"],
          ],
          where: wherePedidos,
          group: ["estado"],
          raw: true,
        }),

        MovimientoStock.findAll({
          attributes: [
            "tipo",
            [Sequelize.fn("COUNT", Sequelize.col("id")), "total"],
          ],
          where: whereMovimientoStock,
          group: ["tipo"],
          raw: true,
        }),
      ]);
    }

    const pedidos_por_estado = ESTADOS_PEDIDO.map((estado) => {
      const encontrado = pedidosPorEstadoRaw.find((p) => p.estado === estado);

      return {
        estado,
        total: Number(encontrado?.total || 0),
      };
    });

    const movimientos_stock_por_tipo = TIPOS_MOVIMIENTO_STOCK.map((tipo) => {
      const encontrado = movimientosStockPorTipoRaw.find((m) => m.tipo === tipo);

      return {
        tipo,
        total: Number(encontrado?.total || 0),
      };
    });

    const detalle_insumos_stock_bajo = esDireccion
      ? detalleInsumosStockBajo.map((insumo) => ({
          id: insumo.id,
          nombre: insumo.nombre,
          categoria: insumo.categoria || "-",
          stock_actual: Number(insumo.stock_actual) || 0,
          stock_minimo: Number(insumo.stock_minimo) || 0,
        }))
      : detalleInsumosStockBajo.map((item) => ({
          id: item.Insumo?.id || item.id,
          nombre: item.Insumo?.nombre || "-",
          categoria: item.Insumo?.categoria || "-",
          stock_actual: Number(item.cantidad) || 0,
          stock_minimo: 0,
        }));

    return res.status(200).json({
      alcance: esDireccion ? "GENERAL" : "OFICINA",
      es_direccion: esDireccion,
      oficina_id: esDireccion ? null : oficinaId,
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
      detalle_insumos_stock_bajo,
      pedidos_por_estado,
      movimientos_stock_por_tipo,
    });
  } catch (error) {
    console.error("ERROR obtenerDashboard:", error);

    return res.status(500).json({
      mensaje: "Error al obtener dashboard",
      error: error.message,
    });
  }
};

module.exports = {
  obtenerDashboard,
};