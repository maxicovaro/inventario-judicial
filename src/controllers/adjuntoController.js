const sharp = require("sharp");
const { Op } = require("sequelize");

const { Adjunto, Activo, Solicitud } = require("../models");
const { esAdminGeneral } = require("../utils/permisos");
const {
  createStoredFilename,
  deleteUpload,
  readUpload,
  saveUpload,
} = require("../utils/uploadStorage");

const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

const mismoId = (a, b) => Number(a) === Number(b);

const verificarPermisoActivo = async (activo_id, req, esDireccion) => {
  if (!activo_id) return null;

  const activo = await Activo.findByPk(activo_id);

  if (!activo) {
    const error = new Error("El activo indicado no existe");
    error.status = 404;
    throw error;
  }

  if (!esDireccion && !mismoId(activo.oficina_id, req.usuario.oficina_id)) {
    const error = new Error(
      "No tenés permiso para acceder a adjuntos de este activo",
    );
    error.status = 403;
    throw error;
  }

  return activo;
};

const verificarPermisoSolicitud = async (solicitud_id, req, esDireccion) => {
  if (!solicitud_id) return null;

  const solicitud = await Solicitud.findByPk(solicitud_id);

  if (!solicitud) {
    const error = new Error("La solicitud indicada no existe");
    error.status = 404;
    throw error;
  }

  const perteneceAlUsuario = mismoId(solicitud.usuario_id, req.usuario.id);
  const perteneceALaOficina = mismoId(
    solicitud.oficina_id,
    req.usuario.oficina_id,
  );

  if (!esDireccion && !perteneceAlUsuario && !perteneceALaOficina) {
    const error = new Error(
      "No tenés permiso para acceder a adjuntos de esta solicitud",
    );
    error.status = 403;
    throw error;
  }

  return solicitud;
};

const verificarPermisoAdjunto = async (adjunto, req, esDireccion) => {
  if (adjunto.activo_id) {
    await verificarPermisoActivo(adjunto.activo_id, req, esDireccion);
  }

  if (adjunto.solicitud_id) {
    await verificarPermisoSolicitud(adjunto.solicitud_id, req, esDireccion);
  }
};

const subirAdjunto = async (req, res) => {
  let archivoGuardado = null;

  try {
    const esDireccion = esAdminGeneral(req.usuario);
    const { activo_id, solicitud_id } = req.body;

    if (!req.file) {
      return res.status(400).json({
        mensaje: "Debe seleccionar un archivo",
      });
    }

    if (!activo_id && !solicitud_id) {
      return res.status(400).json({
        mensaje: "Debe indicar activo_id o solicitud_id",
      });
    }

    if (activo_id && solicitud_id) {
      return res.status(400).json({
        mensaje:
          "El adjunto debe pertenecer a un activo o a una solicitud, no a ambos",
      });
    }

    await verificarPermisoActivo(activo_id, req, esDireccion);
    await verificarPermisoSolicitud(solicitud_id, req, esDireccion);

    if (!Buffer.isBuffer(req.file.buffer)) {
      throw new Error("El archivo recibido no está disponible en memoria");
    }

    let contenido = req.file.buffer;
    let tipoArchivo = req.file.mimetype;
    let rutaArchivo = createStoredFilename(req.file.originalname);

    if (IMAGE_MIME_TYPES.includes(req.file.mimetype)) {
      contenido = await sharp(contenido)
        .resize({ width: 1600, withoutEnlargement: true })
        .jpeg({ quality: 75 })
        .toBuffer();

      rutaArchivo = createStoredFilename(req.file.originalname, ".jpg");
      tipoArchivo = "image/jpeg";
    }

    await saveUpload(rutaArchivo, contenido, tipoArchivo);
    archivoGuardado = rutaArchivo;

    const nuevoAdjunto = await Adjunto.create({
      nombre_archivo: req.file.originalname,
      ruta_archivo: rutaArchivo,
      tipo_archivo: tipoArchivo,
      tamanio: contenido.length,
      activo_id: activo_id || null,
      solicitud_id: solicitud_id || null,
    });

    archivoGuardado = null;

    const adjuntoPublico = nuevoAdjunto.toJSON();
    delete adjuntoPublico.ruta_archivo;

    return res.status(201).json({
      mensaje: "Adjunto subido correctamente",
      adjunto: adjuntoPublico,
    });
  } catch (error) {
    if (archivoGuardado) {
      try {
        await deleteUpload(archivoGuardado);
      } catch {}
    }

    return res.status(error.status || 500).json({
      mensaje: error.status ? error.message : "Error al subir adjunto",
      error: error.message,
    });
  }
};

const listarAdjuntos = async (req, res) => {
  try {
    const esDireccion = esAdminGeneral(req.usuario);
    const { activo_id, solicitud_id } = req.query;

    if (activo_id && solicitud_id) {
      return res.status(400).json({
        mensaje:
          "Debe consultar adjuntos de un activo o de una solicitud, no ambos",
      });
    }

    const where = {};

    if (activo_id) {
      await verificarPermisoActivo(activo_id, req, esDireccion);
      where.activo_id = activo_id;
    } else if (solicitud_id) {
      await verificarPermisoSolicitud(solicitud_id, req, esDireccion);
      where.solicitud_id = solicitud_id;
    } else if (!esDireccion) {
      const alcance = [{ "$Solicitud.usuario_id$": req.usuario.id }];

      if (req.usuario.oficina_id) {
        alcance.push(
          { "$Activo.oficina_id$": req.usuario.oficina_id },
          { "$Solicitud.oficina_id$": req.usuario.oficina_id },
        );
      }

      where[Op.or] = alcance;
    }

    const adjuntos = await Adjunto.findAll({
      where,
      attributes: { exclude: ["ruta_archivo"] },
      include: [
        {
          model: Activo,
          attributes: ["id", "nombre", "oficina_id"],
          required: false,
        },
        {
          model: Solicitud,
          attributes: ["id", "tipo", "usuario_id", "oficina_id"],
          required: false,
        },
      ],
      order: [["id", "DESC"]],
    });

    return res.status(200).json(adjuntos);
  } catch (error) {
    return res.status(error.status || 500).json({
      mensaje: error.status ? error.message : "Error al listar adjuntos",
      error: error.message,
    });
  }
};

const descargarAdjunto = async (req, res) => {
  try {
    const esDireccion = esAdminGeneral(req.usuario);
    const { id } = req.params;

    const adjunto = await Adjunto.findByPk(id);

    if (!adjunto) {
      return res.status(404).json({
        mensaje: "Adjunto no encontrado",
      });
    }

    await verificarPermisoAdjunto(adjunto, req, esDireccion);

    const contenido = await readUpload(adjunto.ruta_archivo);

    if (!contenido) {
      return res.status(404).json({
        mensaje: "El archivo físico no existe",
      });
    }

    res.attachment(adjunto.nombre_archivo);
    res.type(adjunto.tipo_archivo || "application/octet-stream");
    res.setHeader("Content-Length", String(contenido.length));
    return res.send(contenido);
  } catch (error) {
    return res.status(error.status || 500).json({
      mensaje: error.status ? error.message : "Error al descargar adjunto",
      error: error.message,
    });
  }
};

const eliminarAdjunto = async (req, res) => {
  try {
    const esDireccion = esAdminGeneral(req.usuario);
    const { id } = req.params;

    const adjunto = await Adjunto.findByPk(id);

    if (!adjunto) {
      return res.status(404).json({
        mensaje: "Adjunto no encontrado",
      });
    }

    await verificarPermisoAdjunto(adjunto, req, esDireccion);

    await deleteUpload(adjunto.ruta_archivo);
    await adjunto.destroy();

    return res.status(200).json({
      mensaje: "Adjunto eliminado correctamente",
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      mensaje: error.status ? error.message : "Error al eliminar adjunto",
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
