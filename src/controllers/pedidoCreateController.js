const sequelize = require("../config/database");

const {
  PedidoInsumo,
  PedidoInsumoDetalle,
  Insumo,
  Usuario,
  Oficina,
} = require("../models");

const { notificarAdmins } = require("../utils/notificaciones");
const { registrarBitacora } = require("../utils/bitacora");
const { normalizarEnteroNoNegativo } = require("../utils/pedidoRules");

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

    const validacionHechos = normalizarEnteroNoNegativo(
      cantidad_hechos_delictivos,
      "La cantidad de hechos delictivos",
    );

    if (!validacionHechos.valido) {
      return res.status(400).json({
        mensaje: validacionHechos.mensaje,
      });
    }

    const validacionAutopsias = normalizarEnteroNoNegativo(
      cantidad_autopsias,
      "La cantidad de autopsias",
    );

    if (!validacionAutopsias.valido) {
      return res.status(400).json({
        mensaje: validacionAutopsias.mensaje,
      });
    }

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

    const pedidoMensualExistente = await PedidoInsumo.findOne({
      where: {
        oficina_id: usuario.oficina_id,
        mes: mesNum,
        anio: anioNum,
        clave_mensual_unica: 1,
      },
      attributes: ["id"],
      transaction,
    });

    const tipoPedido = pedidoMensualExistente
      ? "COMPLEMENTARIO"
      : "MENSUAL";

    const pedido = await PedidoInsumo.create(
      {
        usuario_id: req.usuario.id,
        oficina_id: usuario.oficina_id,
        mes: mesNum,
        anio: anioNum,
        tipo: tipoPedido,
        clave_mensual_unica: tipoPedido === "MENSUAL" ? 1 : null,
        cantidad_hechos_delictivos: validacionHechos.valor,
        cantidad_autopsias: validacionAutopsias.valor,
        observaciones: observaciones?.trim() || null,
        estado: "ENVIADO",
        fecha_envio: new Date(),
      },
      { transaction },
    );

    const insumosIncluidos = new Set();

    for (const item of detalles) {
      const cantidadSolicitada = Number(item.cantidad_solicitada);

      if (!Number.isInteger(cantidadSolicitada) || cantidadSolicitada < 0) {
        await transaction.rollback();
        transaction = null;

        return res.status(400).json({
          mensaje:
            "La cantidad solicitada debe ser un número entero igual o mayor a 0",
        });
      }

      if (
        item.cantidad_provista !== undefined &&
        Number(item.cantidad_provista) !== 0
      ) {
        await transaction.rollback();
        transaction = null;

        return res.status(403).json({
          mensaje:
            "La cantidad provista solo puede ser definida por Dirección de Policía Judicial",
        });
      }

      const articuloManual = item.articulo_manual?.trim() || null;

      if (!item.insumo_id && !articuloManual) {
        await transaction.rollback();
        transaction = null;

        return res.status(400).json({
          mensaje:
            "Cada detalle debe indicar un insumo del catálogo o un artículo manual",
        });
      }

      let insumoId = null;

      if (item.insumo_id) {
        insumoId = Number(item.insumo_id);

        if (!Number.isInteger(insumoId) || insumoId <= 0) {
          await transaction.rollback();
          transaction = null;

          return res.status(400).json({
            mensaje: "El identificador del insumo no es válido",
          });
        }

        if (insumosIncluidos.has(insumoId)) {
          await transaction.rollback();
          transaction = null;

          return res.status(400).json({
            mensaje: `El insumo con ID ${insumoId} está repetido dentro del pedido`,
          });
        }

        insumosIncluidos.add(insumoId);

        const insumo = await Insumo.findByPk(insumoId, {
          transaction,
        });

        if (!insumo) {
          await transaction.rollback();
          transaction = null;

          return res.status(404).json({
            mensaje: `El insumo con ID ${insumoId} no existe`,
          });
        }

        if (insumo.activo === false) {
          await transaction.rollback();
          transaction = null;

          return res.status(400).json({
            mensaje: `No se puede solicitar el insumo inactivo "${insumo.nombre}"`,
          });
        }
      }

      await PedidoInsumoDetalle.create(
        {
          pedido_id: pedido.id,
          insumo_id: insumoId,
          articulo_manual: insumoId ? null : articuloManual,
          cantidad_solicitada: cantidadSolicitada,
          tuvo_problema: item.tuvo_problema === true,
          detalle_problema: item.detalle_problema?.trim() || null,
          cantidad_provista: 0,
        },
        { transaction },
      );
    }

    await transaction.commit();
    transaction = null;

    const etiquetaPedido =
      tipoPedido === "COMPLEMENTARIO"
        ? "pedido complementario"
        : "pedido mensual";

    try {
      await notificarAdmins({
        titulo:
          tipoPedido === "COMPLEMENTARIO"
            ? "Nuevo pedido complementario enviado"
            : "Nuevo pedido mensual enviado",
        mensaje: `La oficina "${oficina.nombre}" envió el ${etiquetaPedido} N° ${pedido.id} correspondiente a ${mesNum}/${anioNum}.`,
      });
    } catch (errorNotificacion) {
      console.error("Error al notificar administradores:", errorNotificacion);
    }

    try {
      await registrarBitacora({
        usuario_id: req.usuario.id,
        accion: "CREAR",
        modulo: "PEDIDOS",
        descripcion: `Creó el ${etiquetaPedido} N° ${pedido.id} de la oficina ${oficina.nombre} para ${mesNum}/${anioNum}`,
      });
    } catch (errorBitacora) {
      console.error("Error al registrar bitácora:", errorBitacora);
    }

    return res.status(201).json({
      mensaje:
        tipoPedido === "COMPLEMENTARIO"
          ? "Pedido complementario enviado correctamente"
          : "Pedido mensual enviado correctamente",
      pedido,
    });
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }

    if (
      error.name === "SequelizeUniqueConstraintError" ||
      error.original?.code === "ER_DUP_ENTRY"
    ) {
      return res.status(409).json({
        mensaje:
          "Se registró otro pedido mensual para ese período en simultáneo. Volvé a enviar para registrarlo como complementario.",
      });
    }

    return res.status(500).json({
      mensaje: "Error al crear pedido",
      error: error.message,
    });
  }
};

module.exports = {
  crearPedido,
};
