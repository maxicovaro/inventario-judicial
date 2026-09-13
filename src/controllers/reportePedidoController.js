const PDFDocument = require("pdfkit");
const { obtenerDatosResumenPedidos } = require("../services/reportePedidoData");

const resumenPedidos = async (req, res) => {
  try {
    const datos = await obtenerDatosResumenPedidos(req);
    return res.status(200).json(datos);
  } catch (error) {
    console.error("ERROR resumenPedidos:", error);

    return res.status(500).json({
      mensaje: "Error al generar reporte de pedidos",
      error: error.message,
    });
  }
};

const exportarResumenPedidosPDF = async (req, res) => {
  try {
    const {
      totalPedidos,
      porEstado,
      pedidosPorOficina,
      insumosMasSolicitados,
      insumosConProblemas,
    } = await obtenerDatosResumenPedidos(req);

    const doc = new PDFDocument({
      margin: 50,
      size: "A4",
    });

    const fechaActual = new Date().toLocaleDateString("es-AR");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="reporte_general_pedidos.pdf"',
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

    renderSection("Pedidos por estado", porEstado, "estado", "total");

    renderSection(
      "Pedidos por oficina",
      pedidosPorOficina,
      "oficina",
      "total",
    );

    renderSection(
      "Insumos más solicitados",
      insumosMasSolicitados,
      "nombre",
      "total_solicitado",
    );

    renderSection(
      "Insumos con más problemas reportados",
      insumosConProblemas,
      "nombre",
      "total_problemas",
    );

    doc.moveDown(1.5);

    doc.fontSize(8).fillColor("gray").text(
      "Documento generado por el sistema de inventario y pedidos mensuales.",
      50,
      doc.y,
      {
        align: "center",
        width: 495,
      },
    );

    doc.end();
  } catch (error) {
    console.error("ERROR exportarResumenPedidosPDF:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        mensaje: "Error al exportar reporte general a PDF",
        error: error.message,
      });
    }

    return res.end();
  }
};

module.exports = {
  resumenPedidos,
  exportarResumenPedidosPDF,
};
