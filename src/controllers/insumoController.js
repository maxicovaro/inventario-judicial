const { Insumo } = require("../models");
const { registrarBitacora } = require("../utils/bitacora");

const listarInsumos = async (req, res) => {
  try {
    const insumos = await Insumo.findAll({
      order: [["id", "DESC"]],
    });

    return res.status(200).json(insumos);
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al listar insumos",
      error: error.message,
    });
  }
};

const crearInsumo = async (req, res) => {
  try {
    const {
      nombre,
      categoria,
      unidad_medida,
      stock_actual,
      stock_minimo,
      proveedor,
      activo,
    } = req.body;

    if (!nombre) {
      return res.status(400).json({
        mensaje: "El nombre del insumo es obligatorio",
      });
    }

    const existe = await Insumo.findOne({
      where: { nombre },
    });

    if (existe) {
      return res.status(400).json({
        mensaje: "Ya existe un insumo con ese nombre",
      });
    }

    const insumo = await Insumo.create({
      nombre,
      categoria: categoria || null,
      unidad_medida: unidad_medida || null,
      stock_actual: Number(stock_actual) || 0,
      stock_minimo: Number(stock_minimo) || 0,
      proveedor: proveedor || null,
      activo: activo !== undefined ? activo : true,
    });

    await registrarBitacora({
      usuario_id: req.usuario.id,
      accion: "CREAR",
      modulo: "INSUMOS",
      descripcion: `Creó el insumo ${insumo.nombre}`,
    });

    return res.status(201).json({
      mensaje: "Insumo creado correctamente",
      insumo,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al crear insumo",
      error: error.message,
    });
  }
};

const actualizarInsumo = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      categoria,
      unidad_medida,
      stock_actual,
      stock_minimo,
      proveedor,
      activo,
    } = req.body;

    const insumo = await Insumo.findByPk(id);

    if (!insumo) {
      return res.status(404).json({
        mensaje: "Insumo no encontrado",
      });
    }

    if (nombre && nombre !== insumo.nombre) {
      const existe = await Insumo.findOne({
        where: { nombre },
      });

      if (existe) {
        return res.status(400).json({
          mensaje: "Ya existe un insumo con ese nombre",
        });
      }
    }

    await insumo.update({
      nombre,
      categoria,
      unidad_medida,
      stock_actual,
      stock_minimo,
      proveedor,
      activo,
    });

    await registrarBitacora({
      usuario_id: req.usuario.id,
      accion: "EDITAR",
      modulo: "INSUMOS",
      descripcion: `Editó el insumo ${insumo.nombre}`,
    });

    return res.status(200).json({
      mensaje: "Insumo actualizado correctamente",
      insumo,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al actualizar insumo",
      error: error.message,
    });
  }
};

module.exports = {
  listarInsumos,
  crearInsumo,
  actualizarInsumo,
};