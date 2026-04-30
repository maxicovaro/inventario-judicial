const sequelize = require("../config/database");

const {
  PedidoInsumo,
  PedidoInsumoDetalle,
  Insumo,
  Usuario,
  Oficina,
  Role,
  MovimientoStock,
  StockOficina,
} = require("../models");

const { esAdminGeneral, puedeGestionarDeposito } = require("../utils/permisos");

const PDFDocument = require("pdfkit");

const {
  crearNotificacion,
  notificarAdmins,
  alertarStockBajoSiCorresponde,
} = require("../utils/notificaciones");

const { registrarBitacora } = require("../utils/bitacora");

const ESTADOS_VALIDOS = [
  "BORRADOR",
  "ENVIADO",
  "EN_REVISION",
  "APROBADO",
  "ENTREGADO",
  "RECHAZADO",
];

const validarMesAnio = (mes, anio) => {
  const mesNum = Number(mes);
  const anioNum = Number(anio);

  if (!Number.isInteger(mesNum) || mesNum < 1 || mesNum > 12) {
    return {
      valido: false,
      mensaje: "El mes debe ser un número entre 1 y 12",
    };
  }

  if (!Number.isInteger(anioNum) || anioNum < 2020 || anioNum > 2100) {
    return {
      valido: false,
      mensaje: "El año ingresado no es válido",
    };
  }

  return {
    valido: true,
    mesNum,
    anioNum,
  };
};

const crearPedido = async (req, res) => {
  let transaction;

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

    const validacionFecha = validarMesAnio(mes, anio);

    if (!validacionFecha.valido) {
      return res.status(400).json({
        mensaje: validacionFecha.mensaje,
      });
    }

    const { mesNum, anioNum } = validacionFecha;

    transaction = await sequelize.transaction();

    const usuario = await Usuario.findByPk(req.usuario.id, {
      transaction,
    });

    if (!usuario) {
      await transaction.rollback();
      transaction = null;

      return res.status(404).json({
        mensaje: "Usuario no encontrado",
      });
    }

    if (!usuario.oficina_id) {
      await transaction.rollback();
      transaction = null;

      return res.status(400).json({
        mensaje: "El usuario no tiene una oficina asignada",
      });
    }

    const oficina = await Oficina.findByPk(usuario.oficina_id, {
      transaction,
    });

    if (!oficina) {
      await transaction.rollback();
      transaction = null;

      return res.status(404).json({
        mensaje: "La oficina del usuario no existe",
      });
    }

    const existente = await PedidoInsumo.findOne({
      where: {
        oficina_id: usuario.oficina_id,
        mes: mesNum,
        anio: anioNum,
      },
      transaction,
    });

    if (existente) {
      await transaction.rollback();
      transaction = null;

      return res.status(400).json({
        mensaje: "Ya existe un pedido para ese mes y esa oficina",
      });
    }

    const pedido = await PedidoInsumo.create(
      {
        usuario_id: req.usuario.id,
        oficina_id: usuario.oficina_id,
        mes: mesNum,
        anio: anioNum,
        cantidad_hechos_delictivos:
          Number(cantidad_hechos_delictivos) || 0,
        cantidad_autopsias: Number(cantidad_autopsias) || 0,
        observaciones: observaciones?.trim() || null,
        estado: "ENVIADO",
      },
      { transaction }
    );

    for (const item of detalles) {
      const cantidadSolicitada = Number(item.cantidad_solicitada) || 0;
      const cantidadProvista = Number(item.cantidad_provista) || 0;

      if (cantidadSolicitada < 0 || cantidadProvista < 0) {
        await transaction.rollback();
        transaction = null;

        return res.status(400).json({
          mensaje:
            "Las cantidades solicitadas o provistas no pueden ser negativas",
        });
      }

      if (item.insumo_id) {
        const insumo = await Insumo.findByPk(item.insumo_id, {
          transaction,
        });

        if (!insumo) {
          await transaction.rollback();
          transaction = null;

          return res.status(404).json({
            mensaje: `El insumo con ID ${item.insumo_id} no existe`,
          });
        }
      }

      await PedidoInsumoDetalle.create(
        {
          pedido_id: pedido.id,
          insumo_id: item.insumo_id || null,
          articulo_manual: item.articulo_manual?.trim() || null,
          cantidad_solicitada: cantidadSolicitada,
          tuvo_problema: item.tuvo_problema || false,
          detalle_problema: item.detalle_problema?.trim() || null,
          cantidad_provista: cantidadProvista,
        },
        { transaction }
      );
    }

    await transaction.commit();
    transaction = null;

    try {
      await notificarAdmins({
        titulo: "Nuevo pedido mensual enviado",
        mensaje: `La oficina "${oficina.nombre}" envió el pedido mensual N° ${pedido.id} correspondiente a ${mesNum}/${anioNum}.`,
      });
    } catch (errorNotificacion) {
      console.error("Error al notificar administradores:", errorNotificacion);
    }

    try {
      await registrarBitacora({
        usuario_id: req.usuario.id,
        accion: "CREAR",
        modulo: "PEDIDOS",
        descripcion: `Creó el pedido mensual N° ${pedido.id} de la oficina ${oficina.nombre} para ${mesNum}/${anioNum}`,
      });
    } catch (errorBitacora) {
      console.error("Error al registrar bitácora:", errorBitacora);
    }

    return res.status(201).json({
      mensaje: "Pedido creado correctamente",
      pedido,
    });
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }

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

    let where = {};

    if (esAdminGeneral(req.usuario)) {
      where = {};
    } else {
      if (!usuario.oficina_id) {
        return res.status(400).json({
          mensaje: "El usuario no tiene oficina asignada",
        });
      }

      where = {
        oficina_id: usuario.oficina_id,
      };
    }

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
  let transaction;

  try {
    if (!puedeGestionarDeposito(req.usuario)) {
      return res.status(403).json({
        mensaje: "No tenés permisos para proveer pedidos",
      });
    }

    const { detalles, estado } = req.body;

    if (estado && !ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({
        mensaje: "Estado inválido",
      });
    }

    if (!detalles || !Array.isArray(detalles) || detalles.length === 0) {
      return res.status(400).json({
        mensaje: "Debés enviar el detalle de provisión",
      });
    }

    transaction = await sequelize.transaction();

    const pedido = await PedidoInsumo.findByPk(req.params.id, {
      include: [
        { model: Oficina, attributes: ["id", "nombre"] },
        { model: Usuario, attributes: ["id", "nombre", "apellido", "email"] },
      ],
      transaction,
      lock: true,
    });

    if (!pedido) {
      await transaction.rollback();
      transaction = null;

      return res.status(404).json({
        mensaje: "Pedido no encontrado",
      });
    }

    const insumosAfectados = new Set();

    for (const item of detalles) {
      const detallePedido = await PedidoInsumoDetalle.findOne({
        where: {
          id: item.id,
          pedido_id: pedido.id,
        },
        transaction,
        lock: true,
      });

      if (!detallePedido) {
        await transaction.rollback();
        transaction = null;

        return res.status(404).json({
          mensaje: `Detalle de pedido no encontrado o no pertenece al pedido: ${item.id}`,
        });
      }

      const nuevaCantidadProvista = Number(item.cantidad_provista);

      if (
        !Number.isInteger(nuevaCantidadProvista) ||
        nuevaCantidadProvista < 0
      ) {
        await transaction.rollback();
        transaction = null;

        return res.status(400).json({
          mensaje:
            "La cantidad provista debe ser un número entero igual o mayor a 0",
        });
      }

      const cantidadAnteriorProvista =
        Number(detallePedido.cantidad_provista) || 0;

      const diferencia = nuevaCantidadProvista - cantidadAnteriorProvista;

      if (diferencia !== 0 && detallePedido.insumo_id) {
        const insumo = await Insumo.findByPk(detallePedido.insumo_id, {
          transaction,
          lock: true,
        });

        if (!insumo) {
          await transaction.rollback();
          transaction = null;

          return res.status(404).json({
            mensaje: `Insumo no encontrado para el detalle ${item.id}`,
          });
        }

        if (insumo.activo === false) {
          await transaction.rollback();
          transaction = null;

          return res.status(400).json({
            mensaje: `No se puede proveer el insumo inactivo "${insumo.nombre}"`,
          });
        }

        const [stockOficina] = await StockOficina.findOrCreate({
          where: {
            insumo_id: insumo.id,
            oficina_id: pedido.oficina_id,
          },
          defaults: {
            insumo_id: insumo.id,
            oficina_id: pedido.oficina_id,
            cantidad: 0,
          },
          transaction,
        });

        await stockOficina.reload({
          transaction,
          lock: true,
        });

        const stockCentralActual = Number(insumo.stock_actual) || 0;
        const stockOficinaActual = Number(stockOficina.cantidad) || 0;

        if (diferencia > 0) {
          if (stockCentralActual < diferencia) {
            await transaction.rollback();
            transaction = null;

            return res.status(400).json({
              mensaje: `Stock insuficiente para "${insumo.nombre}". Disponible: ${stockCentralActual}, requerido adicional: ${diferencia}`,
            });
          }

          await insumo.update(
            {
              stock_actual: stockCentralActual - diferencia,
            },
            { transaction }
          );

          await stockOficina.update(
            {
              cantidad: stockOficinaActual + diferencia,
            },
            { transaction }
          );

          await MovimientoStock.create(
            {
              insumo_id: insumo.id,
              tipo: "EGRESO",
              cantidad: diferencia,
              motivo: `Entrega por pedido mensual N° ${pedido.id} a ${
                pedido.Oficina?.nombre || "oficina"
              }`,
              usuario_id: req.usuario.id,
              oficina_id: pedido.oficina_id,
            },
            { transaction }
          );
        }

        if (diferencia < 0) {
          const cantidadARevertir = Math.abs(diferencia);

          if (stockOficinaActual < cantidadARevertir) {
            await transaction.rollback();
            transaction = null;

            return res.status(400).json({
              mensaje: `No se puede reducir la provisión de "${insumo.nombre}" porque la oficina ya no tiene stock suficiente para revertir. Stock oficina: ${stockOficinaActual}, a revertir: ${cantidadARevertir}`,
            });
          }

          await insumo.update(
            {
              stock_actual: stockCentralActual + cantidadARevertir,
            },
            { transaction }
          );

          await stockOficina.update(
            {
              cantidad: stockOficinaActual - cantidadARevertir,
            },
            { transaction }
          );

          await MovimientoStock.create(
            {
              insumo_id: insumo.id,
              tipo: "DEVOLUCION",
              cantidad: cantidadARevertir,
              motivo: `Ajuste por reducción de provisión del pedido mensual N° ${
                pedido.id
              } de ${pedido.Oficina?.nombre || "oficina"}`,
              usuario_id: req.usuario.id,
              oficina_id: pedido.oficina_id,
            },
            { transaction }
          );
        }

        insumosAfectados.add(insumo.id);
      }

      await detallePedido.update(
        {
          cantidad_provista: nuevaCantidadProvista,
        },
        { transaction }
      );
    }

    if (estado) {
      await pedido.update(
        {
          estado,
        },
        { transaction }
      );
    }

    await transaction.commit();
    transaction = null;

    for (const insumoId of insumosAfectados) {
      try {
        const insumoActualizado = await Insumo.findByPk(insumoId);

        if (insumoActualizado) {
          await alertarStockBajoSiCorresponde(insumoActualizado);
        }
      } catch (errorAlerta) {
        console.error("Error al generar alerta de stock bajo:", errorAlerta);
      }
    }

    try {
      await crearNotificacion({
        usuario_id: pedido.usuario_id,
        titulo: "Pedido mensual actualizado",
        mensaje: `El pedido mensual N° ${pedido.id} fue actualizado y se registró la provisión correspondiente.`,
      });
    } catch (errorNotificacion) {
      console.error("Error al crear notificación:", errorNotificacion);
    }

    try {
      await registrarBitacora({
        usuario_id: req.usuario.id,
        accion: "PROVEER",
        modulo: "PEDIDOS",
        descripcion: `Registró provisión del pedido mensual N° ${
          pedido.id
        } para ${pedido.Oficina?.nombre || "oficina"}`,
      });
    } catch (errorBitacora) {
      console.error("Error al registrar bitácora:", errorBitacora);
    }

    return res.status(200).json({
      mensaje:
        "Pedido actualizado correctamente, stock central descontado y stock de oficina actualizado",
    });
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }

    console.error("ERROR actualizarProvision:", error);

    return res.status(500).json({
      mensaje: "Error al actualizar provisión",
      error: error.message,
    });
  }
};

const actualizarEstadoPedido = async (req, res) => {
  try {
    const { estado } = req.body;

    if (!esAdminGeneral(req.usuario)) {
      return res.status(403).json({
        mensaje: "Solo Dirección puede cambiar el estado de pedidos",
      });
    }

    if (!estado || !ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({
        mensaje: "Estado inválido",
      });
    }

    const pedido = await PedidoInsumo.findByPk(req.params.id, {
      include: [{ model: Oficina, attributes: ["nombre"] }],
    });

    if (!pedido) {
      return res.status(404).json({
        mensaje: "Pedido no encontrado",
      });
    }

    const estadoAnterior = pedido.estado;

    pedido.estado = estado;
    await pedido.save();

    try {
      await crearNotificacion({
        usuario_id: pedido.usuario_id,
        titulo: "Actualización de pedido mensual",
        mensaje: `Tu pedido mensual N° ${pedido.id} ahora se encuentra en estado: ${estado}.`,
      });
    } catch (errorNotificacion) {
      console.error("Error al crear notificación:", errorNotificacion);
    }

    try {
      await registrarBitacora({
        usuario_id: req.usuario.id,
        accion: "CAMBIAR_ESTADO",
        modulo: "PEDIDOS",
        descripcion: `Cambió el estado del pedido mensual N° ${pedido.id} de ${estadoAnterior} a ${estado} (${pedido.Oficina?.nombre || "-"})`,
      });
    } catch (errorBitacora) {
      console.error("Error al registrar bitácora:", errorBitacora);
    }

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

    if (
      !esAdminGeneral(req.usuario) &&
      String(pedido.oficina_id) !== String(req.usuario.oficina_id)
    ) {
      return res.status(403).json({
        mensaje: "No tenés permisos para exportar pedidos de otra oficina",
      });
    }

    try {
      await registrarBitacora({
        usuario_id: req.usuario.id,
        accion: "EXPORTAR_PDF",
        modulo: "PEDIDOS",
        descripcion: `Exportó a PDF el pedido mensual N° ${pedido.id} (${pedido.Oficina?.nombre || "-"})`,
      });
    } catch (errorBitacora) {
      console.error("Error al registrar bitácora:", errorBitacora);
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
      `Cantidad de hechos delictivos informados: ${
        pedido.cantidad_hechos_delictivos || 0
      }`,
      50
    );

    doc.moveDown(0.3);
    doc.text(
      `Cantidad de autopsias informadas: ${
        pedido.cantidad_autopsias || 0
      }`,
      50
    );

    doc.moveDown(1);

    doc.font("Helvetica-Bold").text("Observaciones generales:", 50);
    doc.font("Helvetica").text(pedido.observaciones || "-", 50, doc.y + 4, {
      width: 495,
      align: "left",
    });

    doc.moveDown(1.5);

    doc.font("Helvetica-Bold").fontSize(11).text("Detalle del pedido", 50);
    doc.moveDown(0.6);

    const startX = 50;
    let y = doc.y;
    const col1 = startX;
    const col2 = 255;
    const col3 = 310;
    const col4 = 365;
    const col5 = 420;

    doc.font("Helvetica-Bold").fontSize(8.5);
    doc.text("Artículo", col1, y, { width: 195 });
    doc.text("Solic.", col2, y, { width: 45, align: "center" });
    doc.text("Prov.", col3, y, { width: 45, align: "center" });
    doc.text("Prob.", col4, y, { width: 45, align: "center" });
    doc.text("Detalle", col5, y, { width: 70 });

    y += 18;
    doc
      .moveTo(startX, y - 4)
      .lineTo(545, y - 4)
      .strokeColor("#999")
      .stroke();

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
        doc
          .moveTo(startX, y - 4)
          .lineTo(545, y - 4)
          .strokeColor("#999")
          .stroke();

        doc.font("Helvetica").fontSize(8.5);
      }

      doc.text(articulo, col1, y, { width: 195 });
      doc.text(solicitada, col2, y, { width: 45, align: "center" });
      doc.text(provista, col3, y, { width: 45, align: "center" });
      doc.text(problema, col4, y, { width: 45, align: "center" });
      doc.text(detalle, col5, y, { width: 70 });

      y += rowHeight + 8;

      doc
        .moveTo(startX, y - 3)
        .lineTo(545, y - 3)
        .strokeColor("#e0e0e0")
        .stroke();
    }

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