const sequelize = require("../config/database");
const {
  PedidoInsumo,
  PedidoInsumoDetalle,
  Insumo,
  Usuario,
  Oficina,
  MovimientoStock,
  StockOficina,
} = require("../models");
const { puedeGestionarDeposito } = require("../utils/permisos");
const {
  crearNotificacion,
  alertarStockBajoSiCorresponde,
} = require("../utils/notificaciones");
const { registrarBitacora } = require("../utils/bitacora");
const {
  ESTADOS_VALIDOS,
  ESTADOS_PROVISIONABLES,
  ESTADOS_PERMITIDOS_DESDE_PROVISION,
  validarTransicionEstado,
  etiquetaPedido,
  tituloPedido,
} = require("../utils/pedidoRules");

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
      return res.status(400).json({ mensaje: "Estado inválido" });
    }

    if (estado && !ESTADOS_PERMITIDOS_DESDE_PROVISION.includes(estado)) {
      return res.status(400).json({
        mensaje: "Ese estado no puede establecerse desde la provisión del pedido",
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
      lock: transaction.LOCK.UPDATE,
    });

    if (!pedido) {
      await transaction.rollback();
      transaction = null;
      return res.status(404).json({ mensaje: "Pedido no encontrado" });
    }

    if (!ESTADOS_PROVISIONABLES.includes(pedido.estado)) {
      await transaction.rollback();
      transaction = null;
      return res.status(409).json({
        mensaje: `El pedido está en estado ${pedido.estado} y ya no admite modificaciones de provisión`,
      });
    }

    if (estado && !validarTransicionEstado(pedido.estado, estado)) {
      await transaction.rollback();
      transaction = null;
      return res.status(409).json({
        mensaje: `Transición de estado no permitida: ${pedido.estado} -> ${estado}`,
      });
    }

    const etiqueta = etiquetaPedido(pedido.tipo);
    const titulo = tituloPedido(pedido.tipo);
    const insumosAfectados = new Set();

    for (const item of detalles) {
      const detallePedido = await PedidoInsumoDetalle.findOne({
        where: {
          id: item.id,
          pedido_id: pedido.id,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!detallePedido) {
        await transaction.rollback();
        transaction = null;
        return res.status(404).json({
          mensaje: `Detalle de pedido no encontrado o no pertenece al pedido: ${item.id}`,
        });
      }

      const nuevaCantidadProvista = Number(item.cantidad_provista);
      if (!Number.isInteger(nuevaCantidadProvista) || nuevaCantidadProvista < 0) {
        await transaction.rollback();
        transaction = null;
        return res.status(400).json({
          mensaje: "La cantidad provista debe ser un número entero igual o mayor a 0",
        });
      }

      const cantidadAnteriorProvista = Number(detallePedido.cantidad_provista) || 0;
      const diferencia = nuevaCantidadProvista - cantidadAnteriorProvista;

      if (diferencia !== 0 && detallePedido.insumo_id) {
        const insumo = await Insumo.findByPk(detallePedido.insumo_id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
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
          lock: transaction.LOCK.UPDATE,
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
            { stock_actual: stockCentralActual - diferencia },
            { transaction },
          );
          await stockOficina.update(
            { cantidad: stockOficinaActual + diferencia },
            { transaction },
          );
          await MovimientoStock.create(
            {
              insumo_id: insumo.id,
              tipo: "EGRESO",
              cantidad: diferencia,
              motivo: `Entrega por ${etiqueta} N° ${pedido.id} a ${pedido.Oficina?.nombre || "oficina"}`,
              usuario_id: req.usuario.id,
              oficina_id: pedido.oficina_id,
            },
            { transaction },
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
            { stock_actual: stockCentralActual + cantidadARevertir },
            { transaction },
          );
          await stockOficina.update(
            { cantidad: stockOficinaActual - cantidadARevertir },
            { transaction },
          );
          await MovimientoStock.create(
            {
              insumo_id: insumo.id,
              tipo: "DEVOLUCION",
              cantidad: cantidadARevertir,
              motivo: `Ajuste por reducción de provisión del ${etiqueta} N° ${pedido.id} de ${pedido.Oficina?.nombre || "oficina"}`,
              usuario_id: req.usuario.id,
              oficina_id: pedido.oficina_id,
            },
            { transaction },
          );
        }

        insumosAfectados.add(insumo.id);
      }

      await detallePedido.update(
        { cantidad_provista: nuevaCantidadProvista },
        { transaction },
      );
    }

    if (estado) {
      await pedido.update({ estado }, { transaction });
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
        titulo: `${titulo} actualizado`,
        mensaje: `El ${etiqueta} N° ${pedido.id} fue actualizado y se registró la provisión correspondiente.`,
      });
    } catch (errorNotificacion) {
      console.error("Error al crear notificación:", errorNotificacion);
    }

    try {
      await registrarBitacora({
        usuario_id: req.usuario.id,
        accion: "PROVEER",
        modulo: "PEDIDOS",
        descripcion: `Registró provisión del ${etiqueta} N° ${pedido.id} para ${pedido.Oficina?.nombre || "oficina"}`,
      });
    } catch (errorBitacora) {
      console.error("Error al registrar bitácora:", errorBitacora);
    }

    return res.status(200).json({
      mensaje: "Pedido actualizado correctamente, stock central descontado y stock de oficina actualizado",
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

module.exports = {
  actualizarProvision,
};
