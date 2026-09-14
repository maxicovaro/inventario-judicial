const sequelize = require("../config/database");
const { PedidoInsumo } = require("../models");
const { crearNotificacion } = require("../utils/notificaciones");
const { registrarBitacora } = require("../utils/bitacora");
const {
  ESTADOS_VALIDOS,
  validarTransicionEstado,
  etiquetaPedido,
  tituloPedido,
} = require("../utils/pedidoRules");
const {
  iniciarTransaccionIdempotente,
  completarIdempotencia,
  responderReplay,
} = require("../utils/idempotencia");

const actualizarEstadoPedidoDeposito = async (req, res) => {
  let transaction;
  let operacionIdempotente;

  try {
    const { estado } = req.body;
    if (!estado || !ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ mensaje: "Estado inválido" });
    }

    if (estado === "ENTREGADO") {
      return res.status(400).json({
        mensaje: "ENTREGADO debe registrarse mediante la provisión del pedido",
      });
    }

    const inicio = await iniciarTransaccionIdempotente({
      sequelize,
      req,
      scope: "deposito:pedido:estado",
    });
    if (inicio.replay) return responderReplay(res, inicio.replay);

    transaction = inicio.transaction;
    operacionIdempotente = inicio.operacion;

    const pedido = await PedidoInsumo.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!pedido) {
      await transaction.rollback();
      transaction = null;
      return res.status(404).json({ mensaje: "Pedido no encontrado" });
    }

    const anterior = pedido.estado;
    if (!validarTransicionEstado(anterior, estado)) {
      await transaction.rollback();
      transaction = null;
      return res.status(409).json({
        mensaje: `Transición de estado no permitida: ${anterior} -> ${estado}`,
      });
    }

    if (anterior !== estado) {
      await pedido.update({ estado }, { transaction });
    }

    const respuesta = { mensaje: "Estado actualizado correctamente", pedido };
    await completarIdempotencia({
      operacion: operacionIdempotente,
      transaction,
      status: 200,
      body: respuesta,
    });
    await transaction.commit();
    transaction = null;

    if (anterior !== estado) {
      const etiqueta = etiquetaPedido(pedido.tipo);
      const titulo = tituloPedido(pedido.tipo);

      try {
        await crearNotificacion({
          usuario_id: pedido.usuario_id,
          titulo: `Actualización de ${titulo.toLowerCase()}`,
          mensaje: `Tu ${etiqueta} N° ${pedido.id} ahora se encuentra en estado: ${estado}.`,
        });
      } catch (errorNotificacion) {
        console.error("Error al notificar estado de pedido:", errorNotificacion);
      }

      try {
        await registrarBitacora({
          usuario_id: req.usuario.id,
          accion: "CAMBIAR_ESTADO",
          modulo: "PEDIDOS",
          descripcion: `Cambió el estado del ${etiqueta} N° ${pedido.id} de ${anterior} a ${estado} desde Depósito Central`,
        });
      } catch (errorBitacora) {
        console.error("Error al registrar bitácora de estado de pedido:", errorBitacora);
      }
    }

    return res.status(200).json(respuesta);
  } catch (error) {
    if (transaction) await transaction.rollback();
    return res.status(error.status || 500).json({
      mensaje: error.status ? error.message : "Error al actualizar estado del pedido",
    });
  }
};

module.exports = {
  actualizarEstadoPedidoDeposito,
};
