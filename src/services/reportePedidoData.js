const { Sequelize, Op } = require("sequelize");
const {
  PedidoInsumo,
  PedidoInsumoDetalle,
  Oficina,
  Insumo,
} = require("../models");
const { esAdminGeneral } = require("../utils/permisos");

const obtenerWherePedido = (req) => {
  if (esAdminGeneral(req.usuario)) return {};
  return { oficina_id: req.usuario.oficina_id };
};

const obtenerIdsPedidosPermitidos = async (wherePedido) => {
  if (Object.keys(wherePedido).length === 0) return null;

  const pedidos = await PedidoInsumo.findAll({
    attributes: ["id"],
    where: wherePedido,
    raw: true,
  });

  const ids = pedidos.map((pedido) => pedido.id);
  return ids.length > 0 ? ids : [-1];
};

const obtenerDatosResumenPedidos = async (req) => {
  const wherePedido = obtenerWherePedido(req);
  const pedidosPermitidosIds = await obtenerIdsPedidosPermitidos(wherePedido);
  const whereDetalleBase = pedidosPermitidosIds
    ? { pedido_id: { [Op.in]: pedidosPermitidosIds } }
    : {};

  const [
    totalPedidos,
    porEstadoRaw,
    pedidosPorOficinaRaw,
    insumosMasSolicitadosRaw,
    insumosConProblemasRaw,
  ] = await Promise.all([
    PedidoInsumo.count({ where: wherePedido }),
    PedidoInsumo.findAll({
      attributes: [
        "estado",
        [Sequelize.fn("COUNT", Sequelize.col("id")), "total"],
      ],
      where: wherePedido,
      group: ["estado"],
      raw: true,
    }),
    PedidoInsumo.findAll({
      attributes: [
        "oficina_id",
        [Sequelize.fn("COUNT", Sequelize.col("PedidoInsumo.id")), "total"],
      ],
      where: wherePedido,
      include: [{ model: Oficina, attributes: ["nombre"] }],
      group: ["oficina_id", "Oficina.id", "Oficina.nombre"],
      raw: true,
    }),
    PedidoInsumoDetalle.findAll({
      attributes: [
        "insumo_id",
        [
          Sequelize.fn(
            "SUM",
            Sequelize.col("PedidoInsumoDetalle.cantidad_solicitada"),
          ),
          "total_solicitado",
        ],
      ],
      include: [{ model: Insumo, attributes: ["nombre"] }],
      where: {
        ...whereDetalleBase,
        insumo_id: { [Op.ne]: null },
      },
      group: ["insumo_id", "Insumo.id", "Insumo.nombre"],
      order: [[Sequelize.literal("total_solicitado"), "DESC"]],
      limit: 10,
      raw: true,
    }),
    PedidoInsumoDetalle.findAll({
      attributes: [
        "insumo_id",
        [
          Sequelize.fn("COUNT", Sequelize.col("PedidoInsumoDetalle.id")),
          "total_problemas",
        ],
      ],
      include: [{ model: Insumo, attributes: ["nombre"] }],
      where: {
        ...whereDetalleBase,
        tuvo_problema: true,
        insumo_id: { [Op.ne]: null },
      },
      group: ["insumo_id", "Insumo.id", "Insumo.nombre"],
      order: [[Sequelize.literal("total_problemas"), "DESC"]],
      limit: 10,
      raw: true,
    }),
  ]);

  return {
    totalPedidos,
    porEstado: porEstadoRaw.map((item) => ({
      estado: item.estado,
      total: Number(item.total),
    })),
    pedidosPorOficina: pedidosPorOficinaRaw.map((item) => ({
      oficina_id: item.oficina_id,
      oficina: item["Oficina.nombre"],
      total: Number(item.total),
    })),
    insumosMasSolicitados: insumosMasSolicitadosRaw.map((item) => ({
      insumo_id: item.insumo_id,
      nombre: item["Insumo.nombre"],
      total_solicitado: Number(item.total_solicitado),
    })),
    insumosConProblemas: insumosConProblemasRaw.map((item) => ({
      insumo_id: item.insumo_id,
      nombre: item["Insumo.nombre"],
      total_problemas: Number(item.total_problemas),
    })),
  };
};

module.exports = {
  obtenerDatosResumenPedidos,
};
