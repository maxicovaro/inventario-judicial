const sequelize = require("../config/database");
const { MovimientoStock, Insumo, Usuario, Oficina } = require("../models");
const { registrarBitacora } = require("../utils/bitacora");
const { esAdminGeneral } = require("../utils/permisos");
const {
  iniciarTransaccionIdempotente,
  completarIdempotencia,
  responderReplay,
} = require("../utils/idempotencia");

const TIPOS_VALIDOS = ["INGRESO", "EGRESO", "DEVOLUCION", "AJUSTE"];

const exigirAdminGeneral = (req, res) => {
  if (!esAdminGeneral(req.usuario)) {
    res.status(403).json({
      mensaje:
        "Acceso denegado. Solo Dirección de Policía Judicial puede administrar movimientos de stock central.",
    });

    return false;
  }

  return true;
};

const listarMovimientosStock = async (req, res) => {
  try {
    if (!exigirAdminGeneral(req, res)) return;

    const movimientos = await MovimientoStock.findAll({
      include: [
        { model: Insumo, attributes: ["id", "nombre", "categoria"] },
        { model: Usuario, attributes: ["id", "nombre", "apellido"] },
        { model: Oficina, attributes: ["id", "nombre"] },
      ],
      order: [["fecha", "DESC"]],
    });

    return res.status(200).json(movimientos);
  } catch (error) {
    console.error("ERROR listarMovimientosStock:", error);
    return res.status(500).json({
      mensaje: "Error al listar movimientos de stock",
    });
  }
};

const crearMovimientoStock = async (req, res) => {
  let transaction;
  let operacionIdempotente;

  try {
    if (!exigirAdminGeneral(req, res)) return;

    const { insumo_id, tipo, cantidad, motivo, oficina_id } = req.body;

    if (!insumo_id || !tipo || cantidad === undefined || cantidad === null) {
      return res.status(400).json({
        mensaje: "Insumo, tipo y cantidad son obligatorios",
      });
    }

    if (!TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({
        mensaje: "Tipo de movimiento inválido",
      });
    }

    const cantidadNum = Number(cantidad);

    if (!Number.isInteger(cantidadNum) || cantidadNum <= 0) {
      return res.status(400).json({
        mensaje: "La cantidad debe ser un número entero mayor a 0",
      });
    }

    if (tipo === "EGRESO" && !oficina_id) {
      return res.status(400).json({
        mensaje: "Para registrar un egreso debe indicar la oficina de destino",
      });
    }

    const inicio = await iniciarTransaccionIdempotente({
      sequelize,
      req,
      scope: "movimiento-stock:create",
    });

    if (inicio.replay) {
      responderReplay(res, inicio.replay);
      return;
    }

    transaction = inicio.transaction;
    operacionIdempotente = inicio.operacion;

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

    if (!insumo.activo) {
      await transaction.rollback();
      transaction = null;
      return res.status(400).json({
        mensaje: "No se pueden registrar movimientos sobre un insumo inactivo",
      });
    }

    let oficina = null;

    if (oficina_id) {
      oficina = await Oficina.findByPk(oficina_id, { transaction });

      if (!oficina) {
        await transaction.rollback();
        transaction = null;
        return res.status(404).json({
          mensaje: "Oficina no encontrada",
        });
      }
    }

    let nuevoStock = Number(insumo.stock_actual) || 0;

    if (tipo === "INGRESO" || tipo === "DEVOLUCION") {
      nuevoStock += cantidadNum;
    }

    if (tipo === "EGRESO") {
      if (nuevoStock < cantidadNum) {
        await transaction.rollback();
        transaction = null;
        return res.status(400).json({
          mensaje: `Stock insuficiente para "${insumo.nombre}"`,
        });
      }

      nuevoStock -= cantidadNum;
    }

    if (tipo === "AJUSTE") {
      nuevoStock = cantidadNum;
    }

    await insumo.update(
      {
        stock_actual: nuevoStock,
      },
      { transaction },
    );

    const movimiento = await MovimientoStock.create(
      {
        insumo_id,
        tipo,
        cantidad: cantidadNum,
        motivo: motivo?.trim() || null,
        fecha: new Date(),
        usuario_id: req.usuario.id,
        oficina_id: oficina_id || null,
      },
      { transaction },
    );

    const movimientoCreado = await MovimientoStock.findByPk(movimiento.id, {
      include: [
        { model: Insumo, attributes: ["id", "nombre", "categoria"] },
        { model: Usuario, attributes: ["id", "nombre", "apellido"] },
        { model: Oficina, attributes: ["id", "nombre"] },
      ],
      transaction,
    });

    const respuesta = {
      mensaje: "Movimiento de stock registrado correctamente",
      movimiento: movimientoCreado,
      stock_actual: nuevoStock,
    };

    await completarIdempotencia({
      operacion: operacionIdempotente,
      transaction,
      status: 201,
      body: respuesta,
    });

    await transaction.commit();
    transaction = null;

    try {
      await registrarBitacora({
        usuario_id: req.usuario.id,
        accion: "MOVIMIENTO",
        modulo: "INSUMOS",
        descripcion: `Registró movimiento ${tipo} del insumo ${
          insumo.nombre
        } por cantidad ${cantidadNum}${
          oficina ? ` para ${oficina.nombre}` : ""
        }${motivo ? ` (${motivo})` : ""}. Stock resultante: ${nuevoStock}`,
      });
    } catch (errorBitacora) {
      console.error("Error al registrar bitácora de stock:", errorBitacora);
    }

    return res.status(201).json(respuesta);
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }

    if (error.status) {
      return res.status(error.status).json({ mensaje: error.message });
    }

    console.error("ERROR crearMovimientoStock:", error);
    return res.status(500).json({
      mensaje: "Error al registrar movimiento de stock",
    });
  }
};

module.exports = {
  listarMovimientosStock,
  crearMovimientoStock,
};
