const sequelize = require("../config/database");
const { PedidoInsumo, Oficina } = require("../models");
const { esAdminGeneral } = require("../utils/permisos");
const { crearNotificacion } = require("../utils/notificaciones");
const { registrarBitacora } = require("../utils/bitacora");
const {
  ESTADOS_VALIDOS,
  validarTransicionEstado,
} = require("../utils/pedidoRules");
const {
  iniciarTransaccionIdempotente,
  completarIdempotencia,
  responderReplay,
} = require("../utils/idempotencia");

const actualizarEstadoPedidoSeguro = async (req, res) => {
  let transaction;
  let operacionIdempotente;

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

    if (estado === "ENTREGADO") {
      return res.status(400).json({
        mensaje:
          "El estado ENTREGADO debe registrarse mediante la provisión del pedido",
      });
    }

    const inicio = await iniciarTransaccionIdempotente({
      sequelize,
      req,
      scope: "pedido:estado",
    });

    if (inicio.replay) {
      responderReplay(res, inicio.replay);
      return;
    }

    transaction = inicio.transaction;
    operacionIdempotente = inicio.operacion;

    const pedido = await PedidoInsumo.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!pedido) {
      await transaction.rollback();
      transaction = null;
      return res.status(404).json({
        mensaje: "Pedido no encontrado",
      });
    }

    const estadoAnterior = pedido.estado;
    const cambioEstado = estadoAnterior !== estado;

    if (!validarTransicionEstado(estadoAnterior, estado)) {
      await transaction.rollback();
      transaction = null;
      return res.status(409).json({
        mensaje:
          `Transición de estado no permitida: ${estadoAnterior} -> ${estado}`,
      });
    }

    if (cambioEstado) {
      await pedido.update({ estado }, { transaction });
    }

    const respuesta = {
      mensaje: "Estado actualizado correctamente",
      pedido,
    };

    await completarIdempotencia({
      operacion: operacionIdempotente,
      transaction,
      status: 200,
      body: respuesta,
    });

    await transaction.commit();
    transaction = null;

    if (cambioEstado) {
      const oficina = pedido.oficina_id
        ? await Oficina.findByPk(pedido.oficina_id, { attributes: ["nombre"] })
        : null;

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
          descripcion: `Cambió el estado del pedido mensual N° ${pedido.id} de ${estadoAnterior} a ${estado} (${oficina?.nombre || "-"})`,
        });
      } catch (errorBitacora) {
        console.error("Error al registrar bitácora:", errorBitacora);
      }
    }

    return res.status(200).json(respuesta);
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }

    if (error.status) {
      return res.status(error.status).json({ mensaje: error.message });
    }

    console.error("ERROR actualizarEstadoPedidoSeguro:", error);
    return res.status(500).json({
      mensaje: "Error al actualizar estado",
    });
  }
};

module.exports = {
  actualizarEstadoPedidoSeguro,
};
