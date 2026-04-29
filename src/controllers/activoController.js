const { Op } = require("sequelize");
const { Activo, Categoria, Oficina } = require("../models");
const { registrarBitacora } = require("../utils/bitacora");

const normalizar = (texto = "") =>
  texto
    .toString()
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const esDireccion = (usuario = {}) => {
  const oficinaNombre = normalizar(usuario.oficina_nombre || "");

  return (
    usuario.role === "ADMIN" &&
    oficinaNombre.includes("DIRECCION") &&
    oficinaNombre.includes("POLICIA JUDICIAL")
  );
};

const listarActivos = async (req, res) => {
  try {
    const where = {};

    if (!esDireccion(req.usuario)) {
      if (!req.usuario?.oficina_id) {
        return res.status(403).json({
          mensaje: "El usuario no tiene oficina asignada",
        });
      }

      where.oficina_id = req.usuario.oficina_id;
    }

    const activos = await Activo.findAll({
      where,
      include: [
        { model: Categoria, attributes: ["id", "nombre"] },
        { model: Oficina, attributes: ["id", "nombre"] },
      ],
      order: [["id", "DESC"]],
    });

    return res.status(200).json(activos);
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al listar activos",
      error: error.message,
    });
  }
};

const crearActivo = async (req, res) => {
  try {
    const direccion = esDireccion(req.usuario);

    const {
      nombre,
      descripcion,
      codigo_interno,
      marca,
      modelo,
      numero_serie,
      cantidad,
      categoria_id,
      oficina_id,
      estado,
      fecha_alta,
      observaciones,
      activo,
    } = req.body;

    const oficinaFinal = direccion ? oficina_id : req.usuario.oficina_id;

    if (!nombre || !categoria_id || !oficinaFinal) {
      return res.status(400).json({
        mensaje: "Nombre, categoría y oficina son obligatorios",
      });
    }

    if (!direccion && estado === "Dado de baja") {
      return res.status(403).json({
        mensaje: "Solo Dirección puede crear o marcar activos como dados de baja",
      });
    }

    const codigoFinal = codigo_interno ? codigo_interno.trim() : null;

    if (codigoFinal) {
      const existente = await Activo.findOne({
        where: { codigo_interno: codigoFinal },
      });

      if (existente) {
        return res.status(400).json({
          mensaje: "Ya existe un activo con ese código interno",
        });
      }
    }

    const categoria = await Categoria.findByPk(categoria_id);

    if (!categoria) {
      return res.status(404).json({
        mensaje: "Categoría no encontrada",
      });
    }

    const oficina = await Oficina.findByPk(oficinaFinal);

    if (!oficina) {
      return res.status(404).json({
        mensaje: "Oficina no encontrada",
      });
    }

    const nuevoActivo = await Activo.create({
      nombre,
      descripcion: descripcion || null,
      codigo_interno: codigoFinal,
      marca: marca || null,
      modelo: modelo || null,
      numero_serie: numero_serie || null,
      cantidad: cantidad ? Number(cantidad) : 1,
      categoria_id,
      oficina_id: oficinaFinal,
      estado: estado || "Buen estado",
      fecha_alta: fecha_alta || null,
      observaciones: observaciones || null,
      activo: direccion ? (activo !== undefined ? activo : true) : true,
    });

    await registrarBitacora({
      usuario_id: req.usuario.id,
      accion: "CREAR",
      modulo: "ACTIVOS",
      descripcion: `Creó el activo ${nuevoActivo.nombre}${
        nuevoActivo.codigo_interno ? ` (${nuevoActivo.codigo_interno})` : ""
      }`,
    });

    return res.status(201).json({
      mensaje: "Activo creado correctamente",
      activo: nuevoActivo,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al crear activo",
      error: error.message,
    });
  }
};

const actualizarActivo = async (req, res) => {
  try {
    const direccion = esDireccion(req.usuario);
    const { id } = req.params;

    const {
      nombre,
      descripcion,
      codigo_interno,
      marca,
      modelo,
      numero_serie,
      cantidad,
      categoria_id,
      oficina_id,
      estado,
      fecha_alta,
      observaciones,
      activo,
    } = req.body;

    const activoDb = await Activo.findByPk(id);

    if (!activoDb) {
      return res.status(404).json({
        mensaje: "Activo no encontrado",
      });
    }

    if (
      !direccion &&
      String(activoDb.oficina_id) !== String(req.usuario.oficina_id)
    ) {
      return res.status(403).json({
        mensaje: "No tenés permisos para modificar activos de otra oficina",
      });
    }

    if (!direccion && estado === "Dado de baja") {
      return res.status(403).json({
        mensaje: "Solo Dirección puede dar de baja activos",
      });
    }

    const codigoFinal =
      codigo_interno !== undefined
        ? codigo_interno
          ? codigo_interno.trim()
          : null
        : activoDb.codigo_interno;

    if (codigoFinal && codigoFinal !== activoDb.codigo_interno) {
      const existente = await Activo.findOne({
        where: {
          codigo_interno: codigoFinal,
          id: { [Op.ne]: id },
        },
      });

      if (existente) {
        return res.status(400).json({
          mensaje: "Ya existe un activo con ese código interno",
        });
      }
    }

    const categoriaFinal = categoria_id || activoDb.categoria_id;
    const oficinaFinal = direccion
      ? oficina_id || activoDb.oficina_id
      : req.usuario.oficina_id;

    const categoria = await Categoria.findByPk(categoriaFinal);

    if (!categoria) {
      return res.status(404).json({
        mensaje: "Categoría no encontrada",
      });
    }

    const oficina = await Oficina.findByPk(oficinaFinal);

    if (!oficina) {
      return res.status(404).json({
        mensaje: "Oficina no encontrada",
      });
    }

    await activoDb.update({
      nombre: nombre !== undefined ? nombre : activoDb.nombre,
      descripcion:
        descripcion !== undefined ? descripcion || null : activoDb.descripcion,
      codigo_interno: codigoFinal,
      marca: marca !== undefined ? marca || null : activoDb.marca,
      modelo: modelo !== undefined ? modelo || null : activoDb.modelo,
      numero_serie:
        numero_serie !== undefined
          ? numero_serie || null
          : activoDb.numero_serie,
      cantidad: cantidad !== undefined ? Number(cantidad) : activoDb.cantidad,
      categoria_id: categoriaFinal,
      oficina_id: oficinaFinal,
      estado: estado !== undefined ? estado : activoDb.estado,
      fecha_alta:
        fecha_alta !== undefined ? fecha_alta || null : activoDb.fecha_alta,
      observaciones:
        observaciones !== undefined
          ? observaciones || null
          : activoDb.observaciones,
      activo: direccion
        ? activo !== undefined
          ? activo
          : activoDb.activo
        : activoDb.activo,
    });

    await registrarBitacora({
      usuario_id: req.usuario.id,
      accion: "EDITAR",
      modulo: "ACTIVOS",
      descripcion: `Editó el activo ${activoDb.nombre}${
        activoDb.codigo_interno ? ` (${activoDb.codigo_interno})` : ""
      }`,
    });

    return res.status(200).json({
      mensaje: "Activo actualizado correctamente",
      activo: activoDb,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al actualizar activo",
      error: error.message,
    });
  }
};

const darDeBajaActivo = async (req, res) => {
  try {
    if (!esDireccion(req.usuario)) {
      return res.status(403).json({
        mensaje: "Solo Dirección puede dar de baja activos",
      });
    }

    const { id } = req.params;

    const activoDb = await Activo.findByPk(id);

    if (!activoDb) {
      return res.status(404).json({
        mensaje: "Activo no encontrado",
      });
    }

    await activoDb.update({
      estado: "Dado de baja",
      activo: false,
    });

    await registrarBitacora({
      usuario_id: req.usuario.id,
      accion: "DAR_DE_BAJA",
      modulo: "ACTIVOS",
      descripcion: `Dio de baja el activo ${activoDb.nombre}${
        activoDb.codigo_interno ? ` (${activoDb.codigo_interno})` : ""
      }`,
    });

    return res.status(200).json({
      mensaje: "Activo dado de baja correctamente",
      activo: activoDb,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al dar de baja activo",
      error: error.message,
    });
  }
};

module.exports = {
  listarActivos,
  crearActivo,
  actualizarActivo,
  darDeBajaActivo,

  // Alias por si tu archivo de rutas lo importa como eliminarActivo
  eliminarActivo: darDeBajaActivo,
};