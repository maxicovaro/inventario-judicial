const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const { Adjunto, Activo, Solicitud } = require("../models");
const { esAdminGeneral } = require("../utils/permisos");

const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

const uploadsDir = path.join(__dirname, "../../storage/uploads");

const mismoId = (a, b) => Number(a) === Number(b);

const asegurarCarpetaUploads = () => {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
};

const borrarArchivoFisico = (nombreArchivo) => {
  if (!nombreArchivo) return;

  const filePath = path.join(uploadsDir, nombreArchivo);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

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
      "No tenés permiso para acceder a adjuntos de este activo"
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
    req.usuario.oficina_id
  );

  if (!esDireccion && !perteneceAlUsuario && !perteneceALaOficina) {
    const error = new Error(
      "No tenés permiso para acceder a adjuntos de esta solicitud"
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
  let archivoFinalParaBorrar = null;

  try {
    asegurarCarpetaUploads();

    const esDireccion = esAdminGeneral(req.usuario);
    const { activo_id, solicitud_id } = req.body;

    if (!req.file) {
      return res.status(400).json({
        mensaje: "Debe seleccionar un archivo",
      });
    }

    archivoFinalParaBorrar = req.file.filename;

    if (!activo_id && !solicitud_id) {
      borrarArchivoFisico(archivoFinalParaBorrar);

      return res.status(400).json({
        mensaje: "Debe indicar activo_id o solicitud_id",
      });
    }

    if (activo_id && solicitud_id) {
      borrarArchivoFisico(archivoFinalParaBorrar);

      return res.status(400).json({
        mensaje:
          "El adjunto debe pertenecer a un activo o a una solicitud, no a ambos",
      });
    }

    await verificarPermisoActivo(activo_id, req, esDireccion);
    await verificarPermisoSolicitud(solicitud_id, req, esDireccion);

    let nombreArchivo = req.file.originalname;
    let rutaArchivo = req.file.filename;
    let tipoArchivo = req.file.mimetype;
    let tamanioArchivo = req.file.size;

    const filePath = path.join(uploadsDir, req.file.filename);

    if (IMAGE_MIME_TYPES.includes(req.file.mimetype)) {
      const compressedFilename = `compressed-${Date.now()}.jpg`;
      const compressedPath = path.join(uploadsDir, compressedFilename);

      await sharp(filePath)
        .resize({ width: 1600, withoutEnlargement: true })
        .jpeg({ quality: 75 })
        .toFile(compressedPath);

      borrarArchivoFisico(req.file.filename);

      archivoFinalParaBorrar = compressedFilename;

      const stats = fs.statSync(compressedPath);

      nombreArchivo = req.file.originalname;
      rutaArchivo = compressedFilename;
      tipoArchivo = "image/jpeg";
      tamanioArchivo = stats.size;
    }

    const nuevoAdjunto = await Adjunto.create({
      nombre_archivo: nombreArchivo,
      ruta_archivo: rutaArchivo,
      tipo_archivo: tipoArchivo,
      tamanio: tamanioArchivo,
      activo_id: activo_id || null,
      solicitud_id: solicitud_id || null,
    });

    archivoFinalParaBorrar = null;

    return res.status(201).json({
      mensaje: "Adjunto subido correctamente",
      adjunto: nuevoAdjunto,
    });
  } catch (error) {
    if (archivoFinalParaBorrar) {
      borrarArchivoFisico(archivoFinalParaBorrar);
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

    if (!activo_id && !solicitud_id) {
      return res.status(400).json({
        mensaje: "Debe indicar activo_id o solicitud_id",
      });
    }

    if (activo_id && solicitud_id) {
      return res.status(400).json({
        mensaje:
          "Debe consultar adjuntos de un activo o de una solicitud, no ambos",
      });
    }

    await verificarPermisoActivo(activo_id, req, esDireccion);
    await verificarPermisoSolicitud(solicitud_id, req, esDireccion);

    const where = {};

    if (activo_id) {
      where.activo_id = activo_id;
    }

    if (solicitud_id) {
      where.solicitud_id = solicitud_id;
    }

    const adjuntos = await Adjunto.findAll({
      where,
      include: [
        {
          model: Activo,
          attributes: ["id", "nombre", "oficina_id"],
        },
        {
          model: Solicitud,
          attributes: ["id", "tipo", "usuario_id", "oficina_id"],
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

    const filePath = path.join(uploadsDir, adjunto.ruta_archivo);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        mensaje: "El archivo físico no existe",
      });
    }

    return res.download(filePath, adjunto.nombre_archivo);
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

    borrarArchivoFisico(adjunto.ruta_archivo);

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