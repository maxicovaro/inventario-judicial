const { MovimientoStock, Insumo, Usuario, Oficina } = require("../models");
const { registrarBitacora } = require("../utils/bitacora");

const listarMovimientosStock = async (req, res) => {
  try {
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
    const { insumo_id, tipo, cantidad, motivo, oficina_id } = req.body;

    if (!insumo_id || !tipo || !cantidad) {
      return res.status(400).json({
        mensaje: "Insumo, tipo y cantidad son obligatorios",
      });
    }

    const insumo = await Insumo.findByPk(insumo_id);

    if (!insumo) {
      return res.status(404).json({
        mensaje: "Insumo no encontrado",
      });
    }

    const cantidadNum = Number(cantidad);

    if (cantidadNum <= 0) {
      return res.status(400).json({
        mensaje: "La cantidad debe ser mayor a 0",
      });
    }

    let nuevoStock = Number(insumo.stock_actual);

    if (tipo === "INGRESO" || tipo === "DEVOLUCION") {
      nuevoStock += cantidadNum;
    } else if (tipo === "EGRESO") {
      if (nuevoStock < cantidadNum) {
        return res.status(400).json({
          mensaje: `Stock insuficiente para "${insumo.nombre}"`,
        });
      }
      nuevoStock -= cantidadNum;
    } else if (tipo === "AJUSTE") {
      nuevoStock = cantidadNum;
    }

    await insumo.update({
      stock_actual: nuevoStock,
    });

    const movimiento = await MovimientoStock.create({
      insumo_id,
      tipo,
      cantidad: cantidadNum,
      motivo: motivo || null,
      fecha: new Date(),
      usuario_id: req.usuario.id,
      oficina_id: oficina_id || null,
    });

    await registrarBitacora({
      usuario_id: req.usuario.id,
      accion: "MOVIMIENTO",
      modulo: "INSUMOS",
      descripcion: `Registró movimiento ${tipo} del insumo ${insumo.nombre} por cantidad ${cantidadNum}${motivo ? ` (${motivo})` : ""}`,
    });

    return res.status(201).json({
      mensaje: "Movimiento de stock registrado correctamente",
      movimiento,
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