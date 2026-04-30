const { MovimientoStock, Insumo, Usuario, Oficina } = require("../models");
const { registrarBitacora } = require("../utils/bitacora");
const { esAdminGeneral } = require("../utils/permisos");

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
    return res.status(500).json({
      mensaje: "Error al listar movimientos de stock",
      error: error.message,
    });
  }
};

const crearMovimientoStock = async (req, res) => {
  try {
    if (!exigirAdminGeneral(req, res)) return;

    const { insumo_id, tipo, cantidad, motivo, oficina_id } = req.body;

    if (!insumo_id || !tipo || !cantidad) {
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

    if (!Number.isFinite(cantidadNum) || cantidadNum <= 0) {
      return res.status(400).json({
        mensaje: "La cantidad debe ser mayor a 0",
      });
    }

    const insumo = await Insumo.findByPk(insumo_id);

    if (!insumo) {
      return res.status(404).json({
        mensaje: "Insumo no encontrado",
      });
    }

    if (!insumo.activo) {
      return res.status(400).json({
        mensaje: "No se pueden registrar movimientos sobre un insumo inactivo",
      });
    }

    let oficina = null;

    if (oficina_id) {
      oficina = await Oficina.findByPk(oficina_id);

      if (!oficina) {
        return res.status(404).json({
          mensaje: "Oficina no encontrada",
        });
      }
    }

    if (tipo === "EGRESO" && !oficina_id) {
      return res.status(400).json({
        mensaje: "Para registrar un egreso debe indicar la oficina de destino",
      });
    }

    let nuevoStock = Number(insumo.stock_actual) || 0;

    if (tipo === "INGRESO" || tipo === "DEVOLUCION") {
      nuevoStock += cantidadNum;
    }

    if (tipo === "EGRESO") {
      if (nuevoStock < cantidadNum) {
        return res.status(400).json({
          mensaje: `Stock insuficiente para "${insumo.nombre}"`,
        });
      }

      nuevoStock -= cantidadNum;
    }

    if (tipo === "AJUSTE") {
      nuevoStock = cantidadNum;
    }

    await insumo.update({
      stock_actual: nuevoStock,
    });

    const movimiento = await MovimientoStock.create({
      insumo_id,
      tipo,
      cantidad: cantidadNum,
      motivo: motivo?.trim() || null,
      fecha: new Date(),
      usuario_id: req.usuario.id,
      oficina_id: oficina_id || null,
    });

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

    const movimientoCreado = await MovimientoStock.findByPk(movimiento.id, {
      include: [
        { model: Insumo, attributes: ["id", "nombre", "categoria"] },
        { model: Usuario, attributes: ["id", "nombre", "apellido"] },
        { model: Oficina, attributes: ["id", "nombre"] },
      ],
    });

    return res.status(201).json({
      mensaje: "Movimiento de stock registrado correctamente",
      movimiento: movimientoCreado,
      stock_actual: nuevoStock,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al registrar movimiento de stock",
      error: error.message,
    });
  }
};

module.exports = {
  listarMovimientosStock,
  crearMovimientoStock,
};