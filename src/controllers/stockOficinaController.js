const sequelize = require("../config/database");

const {
  StockOficina,
  Insumo,
  Oficina,
  MovimientoStock,
} = require("../models");

const { registrarBitacora } = require("../utils/bitacora");
const { alertarStockBajoSiCorresponde } = require("../utils/notificaciones");

const {
  esAdminGeneral,
  puedeGestionarDeposito,
} = require("../utils/permisos");

const obtenerStockPorOficina = async (req, res) => {
  try {
    const { oficina_id } = req.params;

    let oficinaPermitida = oficina_id;

    if (!esAdminGeneral(req.usuario)) {
      oficinaPermitida = req.usuario.oficina_id;

      if (String(oficina_id) !== String(req.usuario.oficina_id)) {
        return res.status(403).json({
          mensaje: "No tenés permisos para consultar stock de otra oficina",
        });
      }
    }

    const stock = await StockOficina.findAll({
      where: {
        oficina_id: oficinaPermitida,
      },
      include: [
        {
          model: Insumo,
          attributes: [
            "id",
            "nombre",
            "categoria",
            "unidad_medida",
          ],
        },
        {
          model: Oficina,
          attributes: ["id", "nombre"],
        },
      ],
      order: [[Insumo, "nombre", "ASC"]],
    });

    return res.status(200).json(stock);
  } catch (error) {
    console.error("ERROR obtenerStockPorOficina:", error);

    return res.status(500).json({
      mensaje: "Error al obtener stock de la oficina",
      error: error.message,
    });
  }
};

const asignarStockAOficina = async (req, res) => {
  let transaction;

  try {
    if (!puedeGestionarDeposito(req.usuario)) {
      return res.status(403).json({
        mensaje:
          "Acceso denegado. Solo Dirección de Policía Judicial puede asignar stock a las oficinas.",
      });
    }

    const {
      insumo_id,
      oficina_id,
      cantidad,
      motivo,
    } = req.body;

    if (!insumo_id || !oficina_id || !cantidad) {
      return res.status(400).json({
        mensaje: "Insumo, oficina y cantidad son obligatorios",
      });
    }

    const cantidadNum = Number(cantidad);

    if (!Number.isInteger(cantidadNum) || cantidadNum <= 0) {
      return res.status(400).json({
        mensaje: "La cantidad debe ser un número entero mayor a 0",
      });
    }

    transaction = await sequelize.transaction();

    /*
      Bloqueamos el insumo mientras se realiza la transferencia.
      De esta manera dos asignaciones simultáneas no deberían
      utilizar el mismo stock central al mismo tiempo.
    */
    const insumo = await Insumo.findByPk(insumo_id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!insumo) {
      await transaction.rollback();
      transaction = null;

      return res.status(404).json({
        mensaje: "Insumo no encontrado",
      });
    }

    if (insumo.activo === false) {
      await transaction.rollback();
      transaction = null;

      return res.status(400).json({
        mensaje: "No se puede asignar stock de un insumo inactivo",
      });
    }

    const oficina = await Oficina.findByPk(oficina_id, {
      transaction,
    });

    if (!oficina) {
      await transaction.rollback();
      transaction = null;

      return res.status(404).json({
        mensaje: "Oficina no encontrada",
      });
    }

    const stockCentralActual = Number(insumo.stock_actual) || 0;

    if (stockCentralActual < cantidadNum) {
      await transaction.rollback();
      transaction = null;

      return res.status(400).json({
        mensaje: `Stock insuficiente. Disponible: ${stockCentralActual}, requerido: ${cantidadNum}`,
      });
    }

    const [stockOficina] = await StockOficina.findOrCreate({
      where: {
        insumo_id: insumo.id,
        oficina_id: oficina.id,
      },
      defaults: {
        insumo_id: insumo.id,
        oficina_id: oficina.id,
        cantidad: 0,
      },
      transaction,
    });

    /*
      Si el registro ya existía, lo volvemos a cargar con bloqueo.
      Así evitamos que dos operaciones modifiquen simultáneamente
      la misma cantidad de stock de la oficina.
    */
    await stockOficina.reload({
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const stockOficinaActual = Number(stockOficina.cantidad) || 0;

    const nuevoStockCentral =
      stockCentralActual - cantidadNum;

    const nuevoStockOficina =
      stockOficinaActual + cantidadNum;

    await insumo.update(
      {
        stock_actual: nuevoStockCentral,
      },
      {
        transaction,
      },
    );

    await stockOficina.update(
      {
        cantidad: nuevoStockOficina,
      },
      {
        transaction,
      },
    );

    await MovimientoStock.create(
      {
        insumo_id: insumo.id,
        tipo: "EGRESO",
        cantidad: cantidadNum,
        motivo:
          motivo?.trim() ||
          `Asignación manual de stock a ${oficina.nombre}`,
        usuario_id: req.usuario.id,
        oficina_id: oficina.id,
      },
      {
        transaction,
      },
    );

    /*
      Recién confirmamos cuando las tres operaciones
      terminaron correctamente.
    */
    await transaction.commit();
    transaction = null;

    /*
      Las alertas y la bitácora se ejecutan después del commit.
      Si alguno de estos servicios secundarios falla,
      no deshacemos una transferencia de stock ya confirmada.
    */
    try {
      const insumoActualizado = await Insumo.findByPk(insumo.id);

      if (insumoActualizado) {
        await alertarStockBajoSiCorresponde(insumoActualizado);
      }
    } catch (errorAlerta) {
      console.error(
        "Error al generar alerta de stock bajo:",
        errorAlerta,
      );
    }

    try {
      await registrarBitacora({
        usuario_id: req.usuario.id,
        accion: "ASIGNAR_STOCK",
        modulo: "STOCK_OFICINA",
        descripcion:
          `Asignó ${cantidadNum} unidad(es) de "${insumo.nombre}" ` +
          `a ${oficina.nombre}. ` +
          `Stock central restante: ${nuevoStockCentral}. ` +
          `Stock oficina: ${nuevoStockOficina}`,
      });
    } catch (errorBitacora) {
      console.error(
        "Error al registrar bitácora:",
        errorBitacora,
      );
    }

    return res.status(200).json({
      mensaje: "Stock asignado correctamente",
      stockOficina,
      stock_central: nuevoStockCentral,
      stock_oficina: nuevoStockOficina,
    });
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }

    console.error("ERROR asignarStockAOficina:", error);

    return res.status(500).json({
      mensaje: "Error al asignar stock a la oficina",
      error: error.message,
    });
  }
};

module.exports = {
  obtenerStockPorOficina,
  asignarStockAOficina,
};