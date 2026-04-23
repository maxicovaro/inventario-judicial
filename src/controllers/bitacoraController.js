const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const { Bitacora, Usuario } = require("../models");

const listarBitacora = async (req, res) => {
  try {
    const registros = await Bitacora.findAll({
      include: [
        {
          model: Usuario,
          attributes: ["id", "nombre", "apellido", "email"],
        },
      ],
      order: [["id", "DESC"]],
    });

    return res.status(200).json(registros);
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al listar bitácora",
      error: error.message,
    });
  }
};

const exportarBitacoraExcel = async (req, res) => {
  try {
    const registros = await Bitacora.findAll({
      include: [
        {
          model: Usuario,
          attributes: ["id", "nombre", "apellido", "email"],
        },
      ],
      order: [["id", "DESC"]],
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Bitácora");

    worksheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Fecha", key: "fecha", width: 22 },
      { header: "Acción", key: "accion", width: 18 },
      { header: "Módulo", key: "modulo", width: 18 },
      { header: "Usuario", key: "usuario", width: 30 },
      { header: "Email", key: "email", width: 30 },
      { header: "Descripción", key: "descripcion", width: 60 },
    ];

    worksheet.getRow(1).font = { bold: true };

    registros.forEach((item) => {
      worksheet.addRow({
        id: item.id,
        fecha: item.fecha
          ? new Date(item.fecha).toLocaleString("es-AR")
          : "-",
        accion: item.accion || "-",
        modulo: item.modulo || "-",
        usuario: item.Usuario
          ? `${item.Usuario.nombre} ${item.Usuario.apellido}`
          : "-",
        email: item.Usuario?.email || "-",
        descripcion: item.descripcion || "-",
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="bitacora.xlsx"',
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al exportar bitácora a Excel",
      error: error.message,
    });
  }
};

const exportarBitacoraPDF = async (req, res) => {
  try {
    const registros = await Bitacora.findAll({
      include: [
        {
          model: Usuario,
          attributes: ["id", "nombre", "apellido", "email"],
        },
      ],
      order: [["id", "DESC"]],
    });

    const doc = new PDFDocument({
      margin: 40,
      size: "A4",
      layout: "landscape",
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="bitacora.pdf"',
    );

    doc.pipe(res);

    doc.font("Helvetica-Bold").fontSize(16).text("Bitácora de acciones", {
      align: "center",
    });

    doc.moveDown(0.5);
    doc
      .font("Helvetica")
      .fontSize(10)
      .text(
        `Fecha de emisión: ${new Date().toLocaleDateString("es-AR")}`,
        { align: "right" },
      );

    doc.moveDown(1);

    const startX = 40;
    let y = doc.y;

    const col1 = startX;
    const col2 = 75;
    const col3 = 160;
    const col4 = 250;
    const col5 = 340;
    const col6 = 520;
    const col7 = 650;

    const drawHeader = () => {
      doc.font("Helvetica-Bold").fontSize(8.5);
      doc.text("ID", col1, y, { width: 30 });
      doc.text("Fecha", col2, y, { width: 75 });
      doc.text("Acción", col3, y, { width: 70 });
      doc.text("Módulo", col4, y, { width: 75 });
      doc.text("Usuario", col5, y, { width: 160 });
      doc.text("Email", col6, y, { width: 120 });
      doc.text("Descripción", col7, y, { width: 120 });

      y += 18;
      doc.moveTo(startX, y - 4).lineTo(800, y - 4).strokeColor("#999").stroke();
      doc.font("Helvetica").fontSize(8);
    };

    drawHeader();

    for (const item of registros) {
      const id = String(item.id || "-");
      const fecha = item.fecha
        ? new Date(item.fecha).toLocaleString("es-AR")
        : "-";
      const accion = item.accion || "-";
      const modulo = item.modulo || "-";
      const usuario = item.Usuario
        ? `${item.Usuario.nombre} ${item.Usuario.apellido}`
        : "-";
      const email = item.Usuario?.email || "-";
      const descripcion = item.descripcion || "-";

      const rowHeight = Math.max(
        doc.heightOfString(usuario, { width: 160 }),
        doc.heightOfString(email, { width: 120 }),
        doc.heightOfString(descripcion, { width: 120 }),
        18,
      );

      if (y + rowHeight > 540) {
        doc.addPage();
        y = 40;
        drawHeader();
      }

      doc.text(id, col1, y, { width: 30 });
      doc.text(fecha, col2, y, { width: 75 });
      doc.text(accion, col3, y, { width: 70 });
      doc.text(modulo, col4, y, { width: 75 });
      doc.text(usuario, col5, y, { width: 160 });
      doc.text(email, col6, y, { width: 120 });
      doc.text(descripcion, col7, y, { width: 120 });

      y += rowHeight + 8;
      doc.moveTo(startX, y - 3).lineTo(800, y - 3).strokeColor("#e0e0e0").stroke();
    }

    doc.end();
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al exportar bitácora a PDF",
      error: error.message,
    });
  }
};

module.exports = {
  listarBitacora,
  exportarBitacoraExcel,
  exportarBitacoraPDF,
};