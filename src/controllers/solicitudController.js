const { Op } = require("sequelize");

const {
  Solicitud,
  Usuario,
  Oficina,
  Activo,
  Notificacion,
} = require("../models");

const { esAdminGeneral } = require("../utils/permisos");

const TIPOS_SOLICITUD = [
  "REPOSICION",
  "REPARACION",
  "BAJA",
  "TRASLADO",
  "ADQUISICION",
];

const PRIORIDADES = ["BAJA", "MEDIA", "ALTA"];

const ESTADOS_SOLICITUD = [
  "PENDIENTE",
  "APROBADA",
  "RECHAZADA",
  "EN_PROCESO",
  "FINALIZADA",
];

const mismoId = (a, b) => {
  if (a === null || a === undefined || b === null || b === undefined) {
    return false;
  }

  return Number(a) === Number(b);
};

const crearError = (mensaje, status = 400) => {
  const error = new Error(mensaje);
  error.status = status;
  throw error;
};

const validarEnum = (valor, permitidos, mensaje) => {
  if (!permitidos.includes(valor)) {
    crearError(mensaje, 400);
  }
};

const validarActivo = async ({ activo_id, req, esDireccion }) => {
  if (!activo_id) return null;

  const activo = await Activo.findByPk(activo_id);

  if (!activo) {
    crearError("El activo indicado no existe", 404);
  }

  if (!esDireccion && !mismoId(activo.oficina_id, req.usuario.oficina_id)) {
    crearError("No tenés permiso para usar un activo de otra oficina", 403);
  }

  return activo;
};

const crearSolicitud = async (req, res) => {
  try {
    const esDireccion = esAdminGeneral(req.usuario);

    const { tipo, descripcion, prioridad, activo_id, oficina_id } = req.body;

    if (!tipo || !descripcion) {
      return res.status(400).json({
        mensaje: "Tipo y descripción son obligatorios",
      });
    }

    validarEnum(tipo, TIPOS_SOLICITUD, "Tipo de solicitud inválido");

    validarEnum(
      prioridad || "MEDIA",
      PRIORIDADES,
      "Prioridad de solicitud inválida"
    );

    if (!esDireccion && !req.usuario.oficina_id) {
      return res.status(403).json({
        mensaje: "El usuario no tiene oficina asignada",
      });
    }

    let oficinaFinalId = req.usuario.oficina_id;

    if (esDireccion && oficina_id) {
      oficinaFinalId = oficina_id;
    }

    if (!oficinaFinalId) {
      return res.status(400).json({
        mensaje: "La oficina es obligatoria",
      });
    }

    if (
      !esDireccion &&
      oficina_id &&
      !mismoId(oficina_id, req.usuario.oficina_id)
    ) {
      return res.status(403).json({
        mensaje: "No tenés permiso para crear solicitudes para otra oficina",
      });
    }

    const oficina = await Oficina.findByPk(oficinaFinalId);

    if (!oficina) {
      return res.status(404).json({
        mensaje: "La oficina indicada no existe",
      });
    }

    const activo = await validarActivo({ activo_id, req, esDireccion });

    if (activo && !mismoId(activo.oficina_id, oficinaFinalId)) {
      return res.status(400).json({
        mensaje: "El activo seleccionado pertenece a otra oficina",
      });
    }

    const nuevaSolicitud = await Solicitud.create({
      tipo,
      descripcion,
      prioridad: prioridad || "MEDIA",
      estado: "PENDIENTE",
      usuario_id: req.usuario.id,
      oficina_id: oficinaFinalId,
      activo_id: activo_id || null,
    });

    return res.status(201).json({
      mensaje: "Solicitud creada correctamente",
      solicitud: nuevaSolicitud,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      mensaje: error.status ? error.message : "Error al crear la solicitud",
      error: error.message,
    });
  }
};

const listarSolicitudes = async (req, res) => {
  try {
    const esDireccion = esAdminGeneral(req.usuario);

    const { estado, tipo, oficina_id, prioridad } = req.query;

    const where = {};

    if (estado) {
      validarEnum(estado, ESTADOS_SOLICITUD, "Estado de solicitud inválido");
      where.estado = estado;
    }

    if (tipo) {
      validarEnum(tipo, TIPOS_SOLICITUD, "Tipo de solicitud inválido");
      where.tipo = tipo;
    }

    if (prioridad) {
      validarEnum(prioridad, PRIORIDADES, "Prioridad de solicitud inválida");
      where.prioridad = prioridad;
    }

    if (esDireccion) {
      if (oficina_id) {
        where.oficina_id = oficina_id;
      }
    } else {
      if (!req.usuario.oficina_id) {
        return res.status(403).json({
          mensaje: "El usuario no tiene oficina asignada",
        });
      }

      where[Op.or] = [
        { usuario_id: req.usuario.id },
        { oficina_id: req.usuario.oficina_id },
      ];
    }

    const solicitudes = await Solicitud.findAll({
      where,
      include: [
        {
          model: Usuario,
          attributes: ["id", "nombre", "apellido", "email"],
        },
        {
          model: Oficina,
          attributes: ["id", "nombre"],
        },
        {
          model: Activo,
          attributes: ["id", "nombre", "codigo_interno", "oficina_id"],
        },
      ],
      order: [["id", "DESC"]],
    });

    return res.status(200).json(solicitudes);
  } catch (error) {
    return res.status(error.status || 500).json({
      mensaje: error.status ? error.message : "Error al listar solicitudes",
      error: error.message,
    });
  }
};

const obtenerSolicitudPorId = async (req, res) => {
  try {
    const esDireccion = esAdminGeneral(req.usuario);
    const { id } = req.params;

    const solicitud = await Solicitud.findByPk(id, {
      include: [
        {
          model: Usuario,
          attributes: ["id", "nombre", "apellido", "email"],
        },
        {
          model: Oficina,
          attributes: ["id", "nombre"],
        },
        {
          model: Activo,
          attributes: ["id", "nombre", "codigo_interno", "oficina_id"],
        },
      ],
    });

    if (!solicitud) {
      return res.status(404).json({
        mensaje: "Solicitud no encontrada",
      });
    }

    const perteneceAlUsuario = mismoId(solicitud.usuario_id, req.usuario.id);

    const perteneceALaOficina = mismoId(
      solicitud.oficina_id,
      req.usuario.oficina_id
    );

    if (!esDireccion && !perteneceAlUsuario && !perteneceALaOficina) {
      return res.status(403).json({
        mensaje: "No tenés permiso para ver esta solicitud",
      });
    }

    return res.status(200).json(solicitud);
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al obtener la solicitud",
      error: error.message,
    });
  }
};

const actualizarSolicitud = async (req, res) => {
  try {
    const esDireccion = esAdminGeneral(req.usuario);
    const { id } = req.params;

    const solicitud = await Solicitud.findByPk(id);

    if (!solicitud) {
      return res.status(404).json({
        mensaje: "Solicitud no encontrada",
      });
    }

    const perteneceAlUsuario = mismoId(solicitud.usuario_id, req.usuario.id);

    const perteneceALaOficina = mismoId(
      solicitud.oficina_id,
      req.usuario.oficina_id
    );

    if (!esDireccion && !perteneceAlUsuario && !perteneceALaOficina) {
      return res.status(403).json({
        mensaje: "No tenés permiso para modificar esta solicitud",
      });
    }

    if (!esDireccion && solicitud.estado !== "PENDIENTE") {
      return res.status(403).json({
        mensaje:
          "La solicitud ya fue revisada por Dirección y no puede ser modificada",
      });
    }

    const { descripcion, prioridad, estado, respuesta_admin, activo_id } =
      req.body;

    if (prioridad !== undefined) {
      validarEnum(prioridad, PRIORIDADES, "Prioridad de solicitud inválida");
    }

    if (estado !== undefined) {
      validarEnum(estado, ESTADOS_SOLICITUD, "Estado de solicitud inválido");
    }

    let activo = null;

    if (activo_id !== undefined && activo_id) {
      activo = await validarActivo({ activo_id, req, esDireccion });

      if (activo && !mismoId(activo.oficina_id, solicitud.oficina_id)) {
        return res.status(400).json({
          mensaje: "El activo seleccionado pertenece a otra oficina",
        });
      }
    }

    const datosActualizar = {};

    if (descripcion !== undefined) {
      datosActualizar.descripcion = descripcion;
    }

    if (prioridad !== undefined) {
      datosActualizar.prioridad = prioridad;
    }

    if (activo_id !== undefined) {
      datosActualizar.activo_id = activo_id || null;
    }

    if (esDireccion) {
      if (estado !== undefined) {
        datosActualizar.estado = estado;
      }

      if (respuesta_admin !== undefined) {
        datosActualizar.respuesta_admin = respuesta_admin || null;
      }
    }

    const estadoAnterior = solicitud.estado;

    await solicitud.update(datosActualizar);

    if (esDireccion && estado && estado !== estadoAnterior) {
      await Notificacion.create({
        titulo: "Actualización de solicitud",
        mensaje: `Tu solicitud #${solicitud.id} cambió a estado ${estado}`,
        usuario_id: solicitud.usuario_id,
      });
    }

    return res.status(200).json({
      mensaje: "Solicitud actualizada correctamente",
      solicitud,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      mensaje: error.status
        ? error.message
        : "Error al actualizar la solicitud",
      error: error.message,
    });
  }
};

const eliminarSolicitud = async (req, res) => {
  try {
    const esDireccion = esAdminGeneral(req.usuario);
    const { id } = req.params;

    const solicitud = await Solicitud.findByPk(id);

    if (!solicitud) {
      return res.status(404).json({
        mensaje: "Solicitud no encontrada",
      });
    }

    const perteneceAlUsuario = mismoId(solicitud.usuario_id, req.usuario.id);

    if (!esDireccion && !perteneceAlUsuario) {
      return res.status(403).json({
        mensaje: "No tenés permiso para eliminar esta solicitud",
      });
    }

    if (!esDireccion && solicitud.estado !== "PENDIENTE") {
      return res.status(403).json({
        mensaje:
          "La solicitud ya fue revisada por Dirección y no puede ser eliminada",
      });
    }

    await solicitud.destroy();

    return res.status(200).json({
      mensaje: "Solicitud eliminada correctamente",
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al eliminar la solicitud",
      error: error.message,
    });
  }
};

module.exports = {
  crearSolicitud,
  listarSolicitudes,
  obtenerSolicitudPorId,
  actualizarSolicitud,
  eliminarSolicitud,
};