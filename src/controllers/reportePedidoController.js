const {
  PedidoInsumo,
  PedidoInsumoDetalle,
  Oficina,
  Insumo,
} = require("../models");
const { Sequelize } = require("sequelize");

const resumenPedidos = async (req, res) => {
  try {
    const totalPedidos = await PedidoInsumo.count();

    const porEstadoRaw = await PedidoInsumo.findAll({
      attributes: [
        "estado",
        [Sequelize.fn("COUNT", Sequelize.col("id")), "total"],
      ],
      group: ["estado"],
      raw: true,
    });

    const pedidosPorOficinaRaw = await PedidoInsumo.findAll({
      attributes: [
        "oficina_id",
        [Sequelize.fn("COUNT", Sequelize.col("PedidoInsumo.id")), "total"],
      ],
      include: [
        {
          model: Oficina,
          attributes: ["nombre"],
        },
      ],
      group: ["oficina_id", "Oficina.id", "Oficina.nombre"],
      raw: true,
    });

    const insumosMasSolicitadosRaw = await PedidoInsumoDetalle.findAll({
      attributes: [
        "insumo_id",
        [
          Sequelize.fn(
            "SUM",
            Sequelize.col("PedidoInsumoDetalle.cantidad_solicitada")
          ),
          "total_solicitado",
        ],
      ],
      include: [
        {
          model: Insumo,
          attributes: ["nombre"],
        },
      ],
      where: {
        insumo_id: { [Sequelize.Op.ne]: null },
      },
      group: ["insumo_id", "Insumo.id", "Insumo.nombre"],
      order: [[Sequelize.literal("total_solicitado"), "DESC"]],
      limit: 10,
      raw: true,
    });

    const insumosConProblemasRaw = await PedidoInsumoDetalle.findAll({
      attributes: [
        "insumo_id",
        [Sequelize.fn("COUNT", Sequelize.col("PedidoInsumoDetalle.id")), "total_problemas"],
      ],
      include: [
        {
          model: Insumo,
          attributes: ["nombre"],
        },
      ],
      where: {
        tuvo_problema: true,
        insumo_id: { [Sequelize.Op.ne]: null },
      },
      group: ["insumo_id", "Insumo.id", "Insumo.nombre"],
      order: [[Sequelize.literal("total_problemas"), "DESC"]],
      limit: 10,
      raw: true,
    });

    return res.status(200).json({
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
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al generar reporte de pedidos",
      error: error.message,
    });
  }
};

module.exports = {
  resumenPedidos,
};