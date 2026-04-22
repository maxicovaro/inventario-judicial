const { Activo, Categoria, Oficina } = require("../models");
const { registrarBitacora } = require("../utils/bitacora");

const listarActivos = async (req, res) => {
  try {
    const activos = await Activo.findAll({
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
    const {
      nombre,
      descripcion,
      codigo_interno,
      categoria_id,
      oficina_id,
      estado,
      activo,
    } = req.body;

    if (!nombre || !categoria_id || !oficina_id) {
      return res.status(400).json({
        mensaje: "Nombre, categoría y oficina son obligatorios",
      });
    }

    if (codigo_interno) {
      const existente = await Activo.findOne({
        where: { codigo_interno },
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

    const oficina = await Oficina.findByPk(oficina_id);
    if (!oficina) {
      return res.status(404).json({
        mensaje: "Oficina no encontrada",
      });
    }

    const nuevoActivo = await Activo.create({
      nombre,
      descripcion: descripcion || null,
      codigo_interno: codigo_interno || null,
      categoria_id,
      oficina_id,
      estado: estado || "ACTIVO",
      activo: activo !== undefined ? activo : true,
    });

    await registrarBitacora({
      usuario_id: req.usuario.id,
      accion: "CREAR",
      modulo: "ACTIVOS",
      descripcion: `Creó el activo ${nuevoActivo.nombre}${nuevoActivo.codigo_interno ? ` (${nuevoActivo.codigo_interno})` : ""}`,
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
    const { id } = req.params;
    const {
      nombre,
      descripcion,
      codigo_interno,
      categoria_id,
      oficina_id,
      estado,
      activo,
    } = req.body;

    const activoDb = await Activo.findByPk(id);

    if (!activoDb) {
      return res.status(404).json({
        mensaje: "Activo no encontrado",
      });
    }

    if (codigo_interno && codigo_interno !== activoDb.codigo_interno) {
      const existente = await Activo.findOne({
        where: { codigo_interno },
      });

      if (existente) {
        return res.status(400).json({
          mensaje: "Ya existe un activo con ese código interno",
        });
      }
    }

    if (categoria_id) {
      const categoria = await Categoria.findByPk(categoria_id);
      if (!categoria) {
        return res.status(404).json({
          mensaje: "Categoría no encontrada",
        });
      }
    }

    if (oficina_id) {
      const oficina = await Oficina.findByPk(oficina_id);
      if (!oficina) {
        return res.status(404).json({
          mensaje: "Oficina no encontrada",
        });
      }
    }

    await activoDb.update({
      nombre,
      descripcion,
      codigo_interno,
      categoria_id,
      oficina_id,
      estado,
      activo,
    });

    await registrarBitacora({
      usuario_id: req.usuario.id,
      accion: "EDITAR",
      modulo: "ACTIVOS",
      descripcion: `Editó el activo ${activoDb.nombre}${activoDb.codigo_interno ? ` (${activoDb.codigo_interno})` : ""}`,
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

module.exports = {
  listarActivos,
  crearActivo,
  actualizarActivo,
};