const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { Activo, Categoria, Oficina, Movimiento } = require("../models");
const { registrarBitacora } = require("../utils/bitacora");
const {
  esAdminGeneral,
  puedeGestionarOficina,
} = require("../utils/permisos");

const registrarBitacoraSegura = async (datos) => {
  try {
    await registrarBitacora(datos);
  } catch (error) {
    console.error("Error al registrar bitácora de activos:", error);
  }
};

const listarActivos = async (req, res) => {
  try {
    const direccion = esAdminGeneral(req.usuario);
    const where = {};

    if (!direccion) {
      if (!req.usuario?.oficina_id) {
        return res.status(403).json({
          mensaje: "El usuario no tiene oficina asignada",
        });
      }

      where.oficina_id = req.usuario.oficina_id;
      where.activo = true;
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
    console.error("Error al listar activos:", error);
    return res.status(500).json({ mensaje: "Error al listar activos" });
  }
};

const crearActivo = async (req, res) => {
  let transaction;

  try {
    if (!puedeGestionarOficina(req.usuario)) {
      return res.status(403).json({
        mensaje:
          "Acceso denegado. Se requiere ser Administrador General o RESPONSABLE de una oficina",
      });
    }

    const direccion = esAdminGeneral(req.usuario);
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
    } = req.body;

    if (Object.prototype.hasOwnProperty.call(req.body, "activo")) {
      return res.status(400).json({
        mensaje: "El campo activo se administra únicamente mediante la baja formal",
      });
    }

    const oficinaFinal = direccion ? oficina_id : req.usuario.oficina_id;

    if (!nombre || !categoria_id || !oficinaFinal) {
      return res.status(400).json({
        mensaje: "Nombre, categoría y oficina son obligatorios",
      });
    }

    if (estado === "Dado de baja") {
      return res.status(400).json({
        mensaje: "La baja debe realizarse con la acción formal Dar de baja",
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

    const [categoria, oficina] = await Promise.all([
      Categoria.findByPk(categoria_id),
      Oficina.findByPk(oficinaFinal),
    ]);

    if (!categoria) {
      return res.status(404).json({ mensaje: "Categoría no encontrada" });
    }

    if (!oficina) {
      return res.status(404).json({ mensaje: "Oficina no encontrada" });
    }

    transaction = await sequelize.transaction();

    const nuevoActivo = await Activo.create(
      {
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
        activo: true,
      },
      { transaction },
    );

    await Movimiento.create(
      {
        activo_id: nuevoActivo.id,
        usuario_id: req.usuario.id,
        tipo: "ALTA",
        descripcion: `Alta del activo en ${oficina.nombre}`,
        fecha: new Date(),
      },
      { transaction },
    );

    await transaction.commit();
    transaction = null;

    await registrarBitacoraSegura({
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
    if (transaction) await transaction.rollback();
    console.error("Error al crear activo:", error);
    return res.status(500).json({ mensaje: "Error al crear activo" });
  }
};

const actualizarActivo = async (req, res) => {
  let transaction;

  try {
    if (!puedeGestionarOficina(req.usuario)) {
      return res.status(403).json({
        mensaje:
          "Acceso denegado. Se requiere ser Administrador General o RESPONSABLE de una oficina",
      });
    }

    const direccion = esAdminGeneral(req.usuario);
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
    } = req.body;

    if (Object.prototype.hasOwnProperty.call(req.body, "activo")) {
      return res.status(400).json({
        mensaje: "El campo activo se administra únicamente mediante la baja formal",
      });
    }

    const activoDb = await Activo.findByPk(id);

    if (!activoDb) {
      return res.status(404).json({ mensaje: "Activo no encontrado" });
    }

    if (activoDb.activo === false || activoDb.estado === "Dado de baja") {
      return res.status(409).json({
        mensaje: "El activo está dado de baja y no puede modificarse",
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

    if (estado === "Dado de baja") {
      return res.status(400).json({
        mensaje: "La baja debe realizarse con la acción formal Dar de baja",
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
    const oficinaAnterior = activoDb.oficina_id;
    const estadoAnterior = activoDb.estado;
    const oficinaFinal = direccion
      ? oficina_id || activoDb.oficina_id
      : req.usuario.oficina_id;

    const [categoria, oficina] = await Promise.all([
      Categoria.findByPk(categoriaFinal),
      Oficina.findByPk(oficinaFinal),
    ]);

    if (!categoria) {
      return res.status(404).json({ mensaje: "Categoría no encontrada" });
    }

    if (!oficina) {
      return res.status(404).json({ mensaje: "Oficina no encontrada" });
    }

    const nuevoEstado = estado !== undefined ? estado : activoDb.estado;
    const traslado = String(oficinaAnterior) !== String(oficinaFinal);
    const cambioEstado = estadoAnterior !== nuevoEstado;

    transaction = await sequelize.transaction();

    await activoDb.update(
      {
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
        estado: nuevoEstado,
        fecha_alta:
          fecha_alta !== undefined ? fecha_alta || null : activoDb.fecha_alta,
        observaciones:
          observaciones !== undefined
            ? observaciones || null
            : activoDb.observaciones,
        activo: activoDb.activo,
      },
      { transaction },
    );

    const movimientos = [];

    if (traslado) {
      movimientos.push({
        tipo: "TRASLADO",
        descripcion: `Traslado de oficina ${oficinaAnterior} a ${oficinaFinal}`,
      });
    }

    if (cambioEstado) {
      movimientos.push({
        tipo: "CAMBIO_ESTADO",
        descripcion: `Cambio de estado: ${estadoAnterior} -> ${nuevoEstado}`,
      });
    }

    if (movimientos.length === 0) {
      movimientos.push({
        tipo: "ACTUALIZACION",
        descripcion: "Actualización de datos del activo",
      });
    }

    await Movimiento.bulkCreate(
      movimientos.map((movimiento) => ({
        activo_id: activoDb.id,
        usuario_id: req.usuario.id,
        tipo: movimiento.tipo,
        descripcion: movimiento.descripcion,
        fecha: new Date(),
      })),
      { transaction },
    );

    await transaction.commit();
    transaction = null;

    await registrarBitacoraSegura({
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
    if (transaction) await transaction.rollback();
    console.error("Error al actualizar activo:", error);
    return res.status(500).json({ mensaje: "Error al actualizar activo" });
  }
};

const darDeBajaActivo = async (req, res) => {
  let transaction;

  try {
    const direccion = esAdminGeneral(req.usuario);

    if (!direccion) {
      return res.status(403).json({ mensaje: "Solo Dirección puede dar de baja activos" });
    }

    const { id } = req.params;
    const activoDb = await Activo.findByPk(id);

    if (!activoDb) {
      return res.status(404).json({ mensaje: "Activo no encontrado" });
    }

    if (activoDb.activo === false || activoDb.estado === "Dado de baja") {
      return res.status(409).json({ mensaje: "El activo ya está dado de baja" });
    }

    transaction = await sequelize.transaction();

    await activoDb.update(
      {
        estado: "Dado de baja",
        activo: false,
      },
      { transaction },
    );

    await Movimiento.create(
      {
        activo_id: activoDb.id,
        usuario_id: req.usuario.id,
        tipo: "BAJA",
        descripcion: "Baja formal del activo",
        fecha: new Date(),
      },
      { transaction },
    );

    await transaction.commit();
    transaction = null;

    await registrarBitacoraSegura({
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
    if (transaction) await transaction.rollback();
    console.error("Error al dar de baja activo:", error);
    return res.status(500).json({ mensaje: "Error al dar de baja activo" });
  }
};

module.exports = {
  listarActivos,
  crearActivo,
  actualizarActivo,
  darDeBajaActivo,
  eliminarActivo: darDeBajaActivo,
};
