const { Movimiento, Activo, Usuario } = require("../models");
const { registrarBitacora } = require("../utils/bitacora");
const {
  esAdminGeneral,
  puedeGestionarOficina,
} = require("../utils/permisos");

const TIPOS_MANUALES_PERMITIDOS = new Set(["REPARACION", "ACTUALIZACION"]);

const listarMovimientos = async (req, res) => {
  try {
    const includeActivo = {
      model: Activo,
      attributes: ["id", "nombre", "codigo_interno", "oficina_id", "estado"],
      required: true,
    };

    if (!esAdminGeneral(req.usuario)) {
      if (!req.usuario?.oficina_id) {
        return res.status(403).json({
          mensaje: "El usuario no tiene oficina asignada",
        });
      }

      includeActivo.where = {
        oficina_id: req.usuario.oficina_id,
      };
    }

    const movimientos = await Movimiento.findAll({
      include: [
        includeActivo,
        { model: Usuario, attributes: ["id", "nombre", "apellido"] },
      ],
      order: [["id", "DESC"]],
    });

    return res.status(200).json(movimientos);
  } catch (error) {
    console.error("Error al listar movimientos de activos:", error);
    return res.status(500).json({
      mensaje: "Error al listar movimientos",
    });
  }
};

const crearMovimiento = async (req, res) => {
  try {
    if (!puedeGestionarOficina(req.usuario)) {
      return res.status(403).json({
        mensaje:
          "Acceso denegado. Se requiere ser Administrador General o RESPONSABLE de una oficina",
      });
    }

    const { activo_id, tipo, descripcion } = req.body;

    if (!activo_id || !tipo) {
      return res.status(400).json({
        mensaje: "Activo y tipo de movimiento son obligatorios",
      });
    }

    if (!TIPOS_MANUALES_PERMITIDOS.has(tipo)) {
      return res.status(400).json({
        mensaje:
          "Ese tipo de movimiento solo puede generarse desde la operación real del activo",
      });
    }

    const activo = await Activo.findByPk(activo_id);

    if (!activo) {
      return res.status(404).json({
        mensaje: "Activo no encontrado",
      });
    }

    if (activo.activo === false || activo.estado === "Dado de baja") {
      return res.status(409).json({
        mensaje: "El activo está dado de baja y no admite movimientos manuales",
      });
    }

    if (
      !esAdminGeneral(req.usuario) &&
      String(activo.oficina_id) !== String(req.usuario.oficina_id)
    ) {
      return res.status(403).json({
        mensaje: "No tenés permisos para registrar movimientos de otra oficina",
      });
    }

    const movimiento = await Movimiento.create({
      activo_id,
      usuario_id: req.usuario.id,
      tipo,
      descripcion: descripcion?.trim() || null,
      fecha: new Date(),
    });

    try {
      await registrarBitacora({
        usuario_id: req.usuario.id,
        accion: "MOVIMIENTO",
        modulo: "ACTIVOS",
        descripcion: `Registró movimiento ${tipo} del activo ${activo.nombre}${
          activo.codigo_interno ? ` (${activo.codigo_interno})` : ""
        }${descripcion?.trim() ? ` - ${descripcion.trim()}` : ""}`,
      });
    } catch (errorBitacora) {
      console.error("Error al registrar bitácora de movimiento:", errorBitacora);
    }

    return res.status(201).json({
      mensaje: "Movimiento registrado correctamente",
      movimiento,
    });
  } catch (error) {
    console.error("Error al registrar movimiento de activo:", error);
    return res.status(500).json({
      mensaje: "Error al registrar movimiento",
    });
  }
};

module.exports = {
  TIPOS_MANUALES_PERMITIDOS,
  listarMovimientos,
  crearMovimiento,
};
