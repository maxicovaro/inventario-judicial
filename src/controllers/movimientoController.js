const { Movimiento, Activo, Usuario } = require("../models");
const { registrarBitacora } = require("../utils/bitacora");

const listarMovimientos = async (req, res) => {
  try {
    const movimientos = await Movimiento.findAll({
      include: [
        { model: Activo, attributes: ["id", "nombre", "codigo_interno"] },
        { model: Usuario, attributes: ["id", "nombre", "apellido"] },
      ],
      order: [["id", "DESC"]],
    });

    return res.status(200).json(movimientos);
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al listar movimientos",
      error: error.message,
    });
  }
};

const crearMovimiento = async (req, res) => {
  try {
    const { activo_id, tipo, descripcion } = req.body;

    if (!activo_id || !tipo) {
      return res.status(400).json({
        mensaje: "Activo y tipo de movimiento son obligatorios",
      });
    }

    const activo = await Activo.findByPk(activo_id);

    if (!activo) {
      return res.status(404).json({
        mensaje: "Activo no encontrado",
      });
    }

    const movimiento = await Movimiento.create({
      activo_id,
      usuario_id: req.usuario.id,
      tipo,
      descripcion: descripcion || null,
      fecha: new Date(),
    });

    await registrarBitacora({
      usuario_id: req.usuario.id,
      accion: "MOVIMIENTO",
      modulo: "ACTIVOS",
      descripcion: `Registró movimiento ${tipo} del activo ${activo.nombre}${activo.codigo_interno ? ` (${activo.codigo_interno})` : ""}${descripcion ? ` - ${descripcion}` : ""}`,
    });

    return res.status(201).json({
      mensaje: "Movimiento registrado correctamente",
      movimiento,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al registrar movimiento",
      error: error.message,
    });
  }
};

module.exports = {
  listarMovimientos,
  crearMovimiento,
};