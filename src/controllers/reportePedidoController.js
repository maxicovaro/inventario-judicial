const {
  PedidoInsumo,
  PedidoInsumoDetalle,
  Oficina,
  Insumo,
} = require("../models");
const { Sequelize, Op } = require("sequelize");
const PDFDocument = require("pdfkit");

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
        insumo_id: { [Op.ne]: null },
      },
      group: ["insumo_id", "Insumo.id", "Insumo.nombre"],
      order: [[Sequelize.literal("total_solicitado"), "DESC"]],
      limit: 10,
      raw: true,
    });

    const insumosConProblemasRaw = await PedidoInsumoDetalle.findAll({
      attributes: [
        "insumo_id",
        [
          Sequelize.fn("COUNT", Sequelize.col("PedidoInsumoDetalle.id")),
          "total_problemas",
        ],
      ],
      include: [
        {
          model: Insumo,
          attributes: ["nombre"],
        },
      ],
      where: {
        tuvo_problema: true,
        insumo_id: { [Op.ne]: null },
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

const exportarResumenPedidosPDF = async (req, res) => {
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
        insumo_id: { [Op.ne]: null },
      },
      group: ["insumo_id", "Insumo.id", "Insumo.nombre"],
      order: [[Sequelize.literal("total_solicitado"), "DESC"]],
      limit: 10,
      raw: true,
    });

    const insumosConProblemasRaw = await PedidoInsumoDetalle.findAll({
      attributes: [
        "insumo_id",
        [
          Sequelize.fn("COUNT", Sequelize.col("PedidoInsumoDetalle.id")),
          "total_problemas",
        ],
      ],
      include: [
        {
          model: Insumo,
          attributes: ["nombre"],
        },
      ],
      where: {
        tuvo_problema: true,
        insumo_id: { [Op.ne]: null },
      },
      group: ["insumo_id", "Insumo.id", "Insumo.nombre"],
      order: [[Sequelize.literal("total_problemas"), "DESC"]],
      limit: 10,
      raw: true,
    });

    const doc = new PDFDocument({
      margin: 50,
      size: "A4",
    });

    const fechaActual = new Date().toLocaleDateString("es-AR");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="reporte_general_pedidos.pdf"`
    );

    doc.pipe(res);

    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .text("DIRECCIÓN DE POLICÍA JUDICIAL", { align: "center" });

    doc
      .font("Helvetica")
      .fontSize(11)
      .text("Reporte general de pedidos mensuales de insumos", {
        align: "center",
      });

    doc.moveDown(0.6);
    doc.fontSize(10).text(`Fecha de emisión: ${fechaActual}`, {
      align: "right",
    });

    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#444").stroke();
    doc.moveDown(1);

    doc.font("Helvetica-Bold").fontSize(12).text("Resumen general");
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(10).text(`Total de pedidos: ${totalPedidos}`);

    doc.moveDown(1);

    const renderSection = (title, items, labelKey, valueKey) => {
      doc.font("Helvetica-Bold").fontSize(11).text(title);
      doc.moveDown(0.5);

      if (!items || items.length === 0) {
        doc.font("Helvetica").fontSize(10).text("Sin datos.");
        doc.moveDown(1);
        return;
      }

      items.forEach((item) => {
        if (doc.y > 740) {
          doc.addPage();
        }

        doc
          .font("Helvetica")
          .fontSize(10)
          .text(`• ${item[labelKey] || "-"}: ${item[valueKey] || 0}`);
      });

      doc.moveDown(1);
    };

    renderSection(
      "Pedidos por estado",
      porEstadoRaw.map((item) => ({
        estado: item.estado,
        total: Number(item.total),
      })),
      "estado",
      "total"
    );

    renderSection(
      "Pedidos por oficina",
      pedidosPorOficinaRaw.map((item) => ({
        oficina: item["Oficina.nombre"],
        total: Number(item.total),
      })),
      "oficina",
      "total"
    );

    renderSection(
      "Insumos más solicitados",
      insumosMasSolicitadosRaw.map((item) => ({
        nombre: item["Insumo.nombre"],
        total_solicitado: Number(item.total_solicitado),
      })),
      "nombre",
      "total_solicitado"
    );

    renderSection(
      "Insumos con más problemas reportados",
      insumosConProblemasRaw.map((item) => ({
        nombre: item["Insumo.nombre"],
        total_problemas: Number(item.total_problemas),
      })),
      "nombre",
      "total_problemas"
    );

    doc.moveDown(1.5);
    doc.fontSize(8).fillColor("gray").text(
      "Documento generado por el sistema de inventario y pedidos mensuales.",
      50,
      doc.y,
      {
        align: "center",
        width: 495,
      }
    );

    doc.end();
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al exportar reporte general a PDF",
      error: error.message,
    });
  }
};

module.exports = {
  resumenPedidos,
  exportarResumenPedidosPDF,
};