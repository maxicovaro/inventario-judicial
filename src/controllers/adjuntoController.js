const fs = require('fs');
const path = require('path');
const { Adjunto, Activo, Solicitud } = require('../models');

const subirAdjunto = async (req, res) => {
  try {
    const { activo_id, solicitud_id } = req.body;

    if (!req.file) {
      return res.status(400).json({
        mensaje: 'Debe seleccionar un archivo',
      });
    }

    if (!activo_id && !solicitud_id) {
      return res.status(400).json({
        mensaje: 'Debe indicar activo_id o solicitud_id',
      });
    }

    if (activo_id) {
      const activo = await Activo.findByPk(activo_id);
      if (!activo) {
        return res.status(404).json({
          mensaje: 'El activo indicado no existe',
        });
      }
    }

    if (solicitud_id) {
      const solicitud = await Solicitud.findByPk(solicitud_id);
      if (!solicitud) {
        return res.status(404).json({
          mensaje: 'La solicitud indicada no existe',
        });
      }
    }

    const nuevoAdjunto = await Adjunto.create({
      nombre_archivo: req.file.originalname,
      ruta_archivo: req.file.filename,
      tipo_archivo: req.file.mimetype,
      tamanio: req.file.size,
      activo_id: activo_id || null,
      solicitud_id: solicitud_id || null,
    });

    return res.status(201).json({
      mensaje: 'Adjunto subido correctamente',
      adjunto: nuevoAdjunto,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al subir adjunto',
      error: error.message,
    });
  }
};

const listarAdjuntos = async (req, res) => {
  try {
    const { activo_id, solicitud_id } = req.query;

    const where = {};

    if (activo_id) where.activo_id = activo_id;
    if (solicitud_id) where.solicitud_id = solicitud_id;

    const adjuntos = await Adjunto.findAll({
      where,
      order: [['id', 'DESC']],
    });

    return res.status(200).json(adjuntos);
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al listar adjuntos',
      error: error.message,
    });
  }
};

const descargarAdjunto = async (req, res) => {
  try {
    const { id } = req.params;

    const adjunto = await Adjunto.findByPk(id);

    if (!adjunto) {
      return res.status(404).json({
        mensaje: 'Adjunto no encontrado',
      });
    }

    const filePath = path.join(__dirname, '..', 'uploads', adjunto.ruta_archivo);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        mensaje: 'El archivo físico no existe',
      });
    }

    return res.download(filePath, adjunto.nombre_archivo);
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al descargar adjunto',
      error: error.message,
    });
  }
};

const eliminarAdjunto = async (req, res) => {
  try {
    const { id } = req.params;

    const adjunto = await Adjunto.findByPk(id);

    if (!adjunto) {
      return res.status(404).json({
        mensaje: 'Adjunto no encontrado',
      });
    }

    const filePath = path.join(__dirname, '..', 'uploads', adjunto.ruta_archivo);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await adjunto.destroy();

    return res.status(200).json({
      mensaje: 'Adjunto eliminado correctamente',
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al eliminar adjunto',
      error: error.message,
    });
  }
};

module.exports = {
  subirAdjunto,
  listarAdjuntos,
  descargarAdjunto,
  eliminarAdjunto,
};