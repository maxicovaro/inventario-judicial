const {
  PedidoInsumo,
  PedidoInsumoDetalle,
  Insumo,
  Usuario,
  Oficina,
  Role,
} = require("../models");

const PDFDocument = require("pdfkit");

const crearPedido = async (req, res) => {
  try {
    const {
      mes,
      anio,
      cantidad_hechos_delictivos,
      cantidad_autopsias,
      observaciones,
      detalles,
    } = req.body;

    if (!mes || !anio || !Array.isArray(detalles) || detalles.length === 0) {
      return res.status(400).json({
        mensaje: "Mes, año y detalles son obligatorios",
      });
    }

    const usuario = await Usuario.findByPk(req.usuario.id);

    if (!usuario) {
      return res.status(404).json({
        mensaje: "Usuario no encontrado",
      });
    }

    if (!usuario.oficina_id) {
      return res.status(400).json({
        mensaje: "El usuario no tiene una oficina asignada",
      });
    }

    const oficina = await Oficina.findByPk(usuario.oficina_id);

    if (!oficina) {
      return res.status(404).json({
        mensaje: "La oficina del usuario no existe",
      });
    }

    const existente = await PedidoInsumo.findOne({
      where: {
        oficina_id: usuario.oficina_id,
        mes,
        anio,
      },
    });

    if (existente) {
      return res.status(400).json({
        mensaje: "Ya existe un pedido para ese mes y esa oficina",
      });
    }

    const pedido = await PedidoInsumo.create({
      usuario_id: req.usuario.id,
      oficina_id: usuario.oficina_id,
      mes,
      anio,
      cantidad_hechos_delictivos: cantidad_hechos_delictivos || 0,
      cantidad_autopsias: cantidad_autopsias || 0,
      observaciones: observaciones || null,
      estado: "ENVIADO",
    });

    for (const item of detalles) {
      if (item.insumo_id) {
        const insumo = await Insumo.findByPk(item.insumo_id);
        if (!insumo) {
          return res.status(404).json({
            mensaje: `El insumo con ID ${item.insumo_id} no existe`,
          });
        }
      }

      await PedidoInsumoDetalle.create({
        pedido_id: pedido.id,
        insumo_id: item.insumo_id || null,
        articulo_manual: item.articulo_manual || null,
        cantidad_solicitada: item.cantidad_solicitada || 0,
        tuvo_problema: item.tuvo_problema || false,
        detalle_problema: item.detalle_problema || null,
        cantidad_provista: item.cantidad_provista || 0,
      });
    }

    return res.status(201).json({
      mensaje: "Pedido creado correctamente",
      pedido,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al crear pedido",
      error: error.message,
    });
  }
};

const listarPedidos = async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.usuario.id, {
      include: [{ model: Role, attributes: ["nombre"] }],
    });

    if (!usuario) {
      return res.status(404).json({
        mensaje: "Usuario no encontrado",
      });
    }

    const nombreRol = usuario.Role?.nombre || "";
    const esAdmin = ["ADMIN", "RESPONSABLE"].includes(nombreRol);

    const where = esAdmin ? {} : { oficina_id: usuario.oficina_id };

    const pedidos = await PedidoInsumo.findAll({
      where,
      include: [
        { model: Usuario, attributes: ["id", "nombre", "apellido"] },
        { model: Oficina, attributes: ["id", "nombre"] },
        {
          model: PedidoInsumoDetalle,
          include: [{ model: Insumo, attributes: ["id", "nombre"] }],
        },
      ],
      order: [["id", "DESC"]],
    });

    return res.status(200).json(pedidos);
  } catch (error) {
    console.error("ERROR listarPedidos:", error);

    return res.status(500).json({
      mensaje: "Error al listar pedidos",
      error: error.message,
    });
  }
};

const actualizarProvision = async (req, res) => {
  try {
    const { detalles, estado } = req.body;

    const pedido = await PedidoInsumo.findByPk(req.params.id);

    if (!pedido) {
      return res.status(404).json({
        mensaje: "Pedido no encontrado",
      });
    }

    if (estado) {
      pedido.estado = estado;
      await pedido.save();
    }

    if (detalles && detalles.length > 0) {
      for (const item of detalles) {
        await PedidoInsumoDetalle.update(
          { cantidad_provista: item.cantidad_provista },
          { where: { id: item.id } }
        );
      }
    }

    return res.json({
      mensaje: "Pedido actualizado correctamente",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      mensaje: "Error al actualizar provisión",
      error: error.message,
    });
  }
};
const actualizarEstadoPedido = async (req, res) => {
  try {
    const { estado } = req.body;

    const estadosValidos = [
      "BORRADOR",
      "ENVIADO",
      "EN_REVISION",
      "APROBADO",
      "ENTREGADO",
      "RECHAZADO",
    ];

    if (!estado || !estadosValidos.includes(estado)) {
      return res.status(400).json({
        mensaje: "Estado inválido",
      });
    }

    const pedido = await PedidoInsumo.findByPk(req.params.id);

    if (!pedido) {
      return res.status(404).json({
        mensaje: "Pedido no encontrado",
      });
    }

    pedido.estado = estado;
    await pedido.save();

    return res.status(200).json({
      mensaje: "Estado actualizado correctamente",
      pedido,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al actualizar estado",
      error: error.message,
    });
  }
};
const exportarPedidoPDF = async (req, res) => {
  try {
    const pedido = await PedidoInsumo.findByPk(req.params.id, {
      include: [
        { model: Usuario, attributes: ["nombre", "apellido"] },
        { model: Oficina, attributes: ["nombre"] },
        {
          model: PedidoInsumoDetalle,
          include: [{ model: Insumo, attributes: ["nombre"] }],
        },
      ],
    });

    if (!pedido) {
      return res.status(404).json({
        mensaje: "Pedido no encontrado",
      });
    }

    const doc = new PDFDocument({
      margin: 50,
      size: "A4",
    });

    const fileName = `pedido_${pedido.id}_${pedido.mes}_${pedido.anio}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    doc.pipe(res);

    const fechaActual = new Date().toLocaleDateString("es-AR");

    // Encabezado institucional
    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .text("DIRECCIÓN DE POLICÍA JUDICIAL", { align: "center" });

    doc
      .font("Helvetica")
      .fontSize(11)
      .text("Pedido mensual de insumos", { align: "center" });

    doc.moveDown(0.8);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#444").stroke();
    doc.moveDown(1);

    // Datos generales
    doc.font("Helvetica-Bold").fontSize(11);
    doc.text("Datos generales del pedido", 50, doc.y);

    doc.moveDown(0.6);
    doc.font("Helvetica").fontSize(10);

    doc.text(`Pedido N°: ${pedido.id}`, 50);
    doc.text(`Fecha de emisión: ${fechaActual}`, 320);

    doc.moveDown(0.3);
    doc.text(`Mes/Año: ${pedido.mes}/${pedido.anio}`, 50);
    doc.text(`Estado: ${pedido.estado}`, 320);

    doc.moveDown(0.3);
    doc.text(`Oficina solicitante: ${pedido.Oficina?.nombre || "-"}`, 50);

    doc.moveDown(0.3);
    doc.text(
      `Usuario: ${
        pedido.Usuario
          ? `${pedido.Usuario.nombre} ${pedido.Usuario.apellido}`
          : "-"
      }`,
      50
    );

    doc.moveDown(0.3);
    doc.text(
      `Cantidad de hechos delictivos informados: ${pedido.cantidad_hechos_delictivos || 0}`,
      50
    );

    doc.moveDown(0.3);
    doc.text(
      `Cantidad de autopsias informadas: ${pedido.cantidad_autopsias || 0}`,
      50
    );

    doc.moveDown(1);

    // Observaciones
    doc.font("Helvetica-Bold").text("Observaciones generales:", 50);
    doc
      .font("Helvetica")
      .text(pedido.observaciones || "-", 50, doc.y + 4, {
        width: 495,
        align: "left",
      });

    doc.moveDown(1.5);

    // Título detalle
    doc.font("Helvetica-Bold").fontSize(11).text("Detalle del pedido", 50);
    doc.moveDown(0.6);

    // Cabecera tabla
    const startX = 50;
    let y = doc.y;
    const col1 = startX;
    const col2 = 255;
    const col3 = 310;
    const col4 = 365;
    const col5 = 420;
    const col6 = 470;

    doc.font("Helvetica-Bold").fontSize(8.5);
    doc.text("Artículo", col1, y, { width: 195 });
    doc.text("Solic.", col2, y, { width: 45, align: "center" });
    doc.text("Prov.", col3, y, { width: 45, align: "center" });
    doc.text("Prob.", col4, y, { width: 45, align: "center" });
    doc.text("Detalle", col5, y, { width: 70 });

    y += 18;
    doc.moveTo(startX, y - 4).lineTo(545, y - 4).strokeColor("#999").stroke();
    doc.font("Helvetica").fontSize(8.5);

    for (const item of pedido.PedidoInsumoDetalles || []) {
      const articulo = item.Insumo?.nombre || item.articulo_manual || "-";
      const solicitada = String(item.cantidad_solicitada || 0);
      const provista = String(item.cantidad_provista || 0);
      const problema = item.tuvo_problema ? "Sí" : "No";
      const detalle = item.detalle_problema || "-";

      const rowHeight = Math.max(
        doc.heightOfString(articulo, { width: 195 }),
        doc.heightOfString(detalle, { width: 70 }),
        18
      );

      if (y + rowHeight > 730) {
        doc.addPage();
        y = 50;

        doc.font("Helvetica-Bold").fontSize(8.5);
        doc.text("Artículo", col1, y, { width: 195 });
        doc.text("Solic.", col2, y, { width: 45, align: "center" });
        doc.text("Prov.", col3, y, { width: 45, align: "center" });
        doc.text("Prob.", col4, y, { width: 45, align: "center" });
        doc.text("Detalle", col5, y, { width: 70 });

        y += 18;
        doc.moveTo(startX, y - 4).lineTo(545, y - 4).strokeColor("#999").stroke();
        doc.font("Helvetica").fontSize(8.5);
      }

      doc.text(articulo, col1, y, { width: 195 });
      doc.text(solicitada, col2, y, { width: 45, align: "center" });
      doc.text(provista, col3, y, { width: 45, align: "center" });
      doc.text(problema, col4, y, { width: 45, align: "center" });
      doc.text(detalle, col5, y, { width: 70 });

      y += rowHeight + 8;
      doc.moveTo(startX, y - 3).lineTo(545, y - 3).strokeColor("#e0e0e0").stroke();
    }

    // Firmas
    y += 35;

    if (y > 700) {
      doc.addPage();
      y = 80;
    }

    doc.moveTo(70, y).lineTo(240, y).strokeColor("#444").stroke();
    doc.moveTo(340, y).lineTo(510, y).strokeColor("#444").stroke();

    doc.font("Helvetica").fontSize(10);
    doc.text("Firma oficina solicitante", 90, y + 6);
    doc.text("Firma y recepción Dirección", 360, y + 6);

    // Pie
    doc.fontSize(8).fillColor("gray");
    doc.text(
      "Documento generado por el sistema de inventario y pedidos mensuales.",
      50,
      790,
      { align: "center", width: 495 }
    );

    doc.end();
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al exportar pedido a PDF",
      error: error.message,
    });
  }
};

module.exports = {
  crearPedido,
  listarPedidos,
  actualizarProvision,
  actualizarEstadoPedido,
  exportarPedidoPDF,
};