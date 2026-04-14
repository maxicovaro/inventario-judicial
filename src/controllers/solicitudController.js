const { Op } = require('sequelize');
const {
  Solicitud,
  Usuario,
  Oficina,
  Activo,
  Notificacion,
} = require('../models');

const crearSolicitud = async (req, res) => {
  try {
    const {
      tipo,
      descripcion,
      prioridad,
      activo_id,
      oficina_id,
    } = req.body;

    if (!tipo || !descripcion) {
      return res.status(400).json({
        mensaje: 'Tipo y descripción son obligatorios',
      });
    }

    let oficinaFinalId = oficina_id || req.usuario.oficina_id;

    if (activo_id) {
      const activo = await Activo.findByPk(activo_id);
      if (!activo) {
        return res.status(404).json({
          mensaje: 'El activo indicado no existe',
        });
      }
    }

    if (oficinaFinalId) {
      const oficina = await Oficina.findByPk(oficinaFinalId);
      if (!oficina) {
        return res.status(404).json({
          mensaje: 'La oficina indicada no existe',
        });
      }
    }

    const nuevaSolicitud = await Solicitud.create({
      tipo,
      descripcion,
      prioridad,
      estado: 'PENDIENTE',
      usuario_id: req.usuario.id,
      oficina_id: oficinaFinalId,
      activo_id: activo_id || null,
    });

    return res.status(201).json({
      mensaje: 'Solicitud creada correctamente',
      solicitud: nuevaSolicitud,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al crear la solicitud',
      error: error.message,
    });
  }
};

const listarSolicitudes = async (req, res) => {
  try {
    const { estado, tipo, oficina_id, prioridad } = req.query;

    const where = {};

    if (estado) where.estado = estado;
    if (tipo) where.tipo = tipo;
    if (oficina_id) where.oficina_id = oficina_id;
    if (prioridad) where.prioridad = prioridad;

    // Si no es ADMIN, solo ve sus solicitudes o las de su oficina
    if (req.usuario.role !== 'ADMIN') {
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
          attributes: ['id', 'nombre', 'apellido', 'email'],
        },
        {
          model: Oficina,
          attributes: ['id', 'nombre'],
        },
        {
          model: Activo,
          attributes: ['id', 'nombre', 'codigo_interno'],
        },
      ],
      order: [['id', 'DESC']],
    });

    return res.status(200).json(solicitudes);
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al listar solicitudes',
      error: error.message,
    });
  }
};

const obtenerSolicitudPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const solicitud = await Solicitud.findByPk(id, {
      include: [
        {
          model: Usuario,
          attributes: ['id', 'nombre', 'apellido', 'email'],
        },
        {
          model: Oficina,
          attributes: ['id', 'nombre'],
        },
        {
          model: Activo,
          attributes: ['id', 'nombre', 'codigo_interno'],
        },
      ],
    });

    if (!solicitud) {
      return res.status(404).json({
        mensaje: 'Solicitud no encontrada',
      });
    }

    if (
      req.usuario.role !== 'ADMIN' &&
      solicitud.usuario_id !== req.usuario.id &&
      solicitud.oficina_id !== req.usuario.oficina_id
    ) {
      return res.status(403).json({
        mensaje: 'No tenés permiso para ver esta solicitud',
      });
    }

    return res.status(200).json(solicitud);
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al obtener la solicitud',
      error: error.message,
    });
  }
};

const actualizarSolicitud = async (req, res) => {
  try {
    const { id } = req.params;
    const solicitud = await Solicitud.findByPk(id);

    if (!solicitud) {
      return res.status(404).json({
        mensaje: 'Solicitud no encontrada',
      });
    }

    const esAdmin = req.usuario.role === 'ADMIN';

    if (
      !esAdmin &&
      solicitud.usuario_id !== req.usuario.id &&
      solicitud.oficina_id !== req.usuario.oficina_id
    ) {
      return res.status(403).json({
        mensaje: 'No tenés permiso para modificar esta solicitud',
      });
    }

    const {
      descripcion,
      prioridad,
      estado,
      respuesta_admin,
      activo_id,
    } = req.body;

    if (activo_id) {
      const activo = await Activo.findByPk(activo_id);
      if (!activo) {
        return res.status(404).json({
          mensaje: 'El activo indicado no existe',
        });
      }
    }

    // Usuarios no admin no pueden cambiar estado ni respuesta_admin
    const datosActualizar = {
      descripcion,
      prioridad,
      activo_id,
    };

    if (esAdmin) {
      datosActualizar.estado = estado;
      datosActualizar.respuesta_admin = respuesta_admin;
    }

    const estadoAnterior = solicitud.estado;

await solicitud.update(datosActualizar);

// Notificación simple al creador cuando un admin cambia el estado
if (esAdmin && estado && estado !== estadoAnterior) {
      await Notificacion.create({
        titulo: 'Actualización de solicitud',
        mensaje: `Tu solicitud #${solicitud.id} cambió a estado ${estado}`,
        usuario_id: solicitud.usuario_id,
      });
    }

    return res.status(200).json({
      mensaje: 'Solicitud actualizada correctamente',
      solicitud,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al actualizar la solicitud',
      error: error.message,
    });
  }
};

const eliminarSolicitud = async (req, res) => {
  try {
    const { id } = req.params;
    const solicitud = await Solicitud.findByPk(id);

    if (!solicitud) {
      return res.status(404).json({
        mensaje: 'Solicitud no encontrada',
      });
    }

    const esAdmin = req.usuario.role === 'ADMIN';

    if (!esAdmin && solicitud.usuario_id !== req.usuario.id) {
      return res.status(403).json({
        mensaje: 'No tenés permiso para eliminar esta solicitud',
      });
    }

    await solicitud.destroy();

    return res.status(200).json({
      mensaje: 'Solicitud eliminada correctamente',
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al eliminar la solicitud',
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