const { Activo, Categoria, Oficina, Movimiento } = require("../models");

const crearActivo = async (req, res) => {
  try {
    const {
      codigo_interno,
      nombre,
      descripcion,
      marca,
      modelo,
      numero_serie,
      cantidad,
      estado,
      fecha_alta,
      observaciones,
      categoria_id,
      oficina_id,
    } = req.body;

    if (!nombre || !categoria_id || !oficina_id) {
      return res.status(400).json({
        mensaje: "Nombre, categoría y oficina son obligatorios",
      });
    }

    const categoria = await Categoria.findByPk(categoria_id);
    if (!categoria) {
      return res.status(404).json({
        mensaje: "La categoría indicada no existe",
      });
    }

    const oficina = await Oficina.findByPk(oficina_id);
    if (!oficina) {
      return res.status(404).json({
        mensaje: "La oficina indicada no existe",
      });
    }

    const nuevoActivo = await Activo.create({
      codigo_interno,
      nombre,
      descripcion,
      marca,
      modelo,
      numero_serie,
      cantidad,
      estado,
      fecha_alta,
      observaciones,
      categoria_id,
      oficina_id,
    });
    await Movimiento.create({
      tipo: "ALTA",
      descripcion: `Se dio de alta el activo "${nuevoActivo.nombre}"`,
      activo_id: nuevoActivo.id,
      usuario_id: req.usuario.id,
    });

    return res.status(201).json({
      mensaje: "Activo creado correctamente",
      activo: nuevoActivo,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al crear el activo",
      error: error.message,
    });
  }
};

const listarActivos = async (req, res) => {
  try {
    const activos = await Activo.findAll({
      where: { activo: true },
      include: [
        { model: Categoria, attributes: ["id", "nombre"] },
        { model: Oficina, attributes: ["id", "nombre"] },
      ],
      order: [["id", "DESC"]],
    });

    return res.status(200).json(activos);
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al listar los activos",
      error: error.message,
    });
  }
};

const obtenerActivoPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const activo = await Activo.findByPk(id, {
      include: [
        { model: Categoria, attributes: ["id", "nombre"] },
        { model: Oficina, attributes: ["id", "nombre"] },
      ],
    });

    if (!activo) {
      return res.status(404).json({
        mensaje: "Activo no encontrado",
      });
    }

    if (!activo.activo) {
      return res.status(404).json({
        mensaje: "Activo no encontrado",
      });
    }

    return res.status(200).json(activo);
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al obtener el activo",
      error: error.message,
    });
  }
};

const actualizarActivo = async (req, res) => {
  try {
    const { id } = req.params;
    const activo = await Activo.findByPk(id);

    if (!activo) {
      return res.status(404).json({
        mensaje: "Activo no encontrado",
      });
    }

    const {
      codigo_interno,
      nombre,
      descripcion,
      marca,
      modelo,
      numero_serie,
      cantidad,
      estado,
      fecha_alta,
      activo: activoEstado,
      observaciones,
      categoria_id,
      oficina_id,
    } = req.body;

    if (categoria_id) {
      const categoria = await Categoria.findByPk(categoria_id);
      if (!categoria) {
        return res.status(404).json({
          mensaje: "La categoría indicada no existe",
        });
      }
    }

    if (oficina_id) {
      const oficina = await Oficina.findByPk(oficina_id);
      if (!oficina) {
        return res.status(404).json({
          mensaje: "La oficina indicada no existe",
        });
      }
    }
    const estadoAnterior = activo.estado;
    const oficinaAnterior = activo.oficina_id;
    await activo.update({
      codigo_interno,
      nombre,
      descripcion,
      marca,
      modelo,
      numero_serie,
      cantidad,
      estado,
      fecha_alta,
      activo: activoEstado,
      observaciones,
      categoria_id,
      oficina_id,
    });
    let tipoMovimiento = "ACTUALIZACION";
    let descripcionMovimiento = `Se actualizó el activo "${activo.nombre}"`;

    if (estado && estado !== estadoAnterior) {
      tipoMovimiento = "CAMBIO_ESTADO";
      descripcionMovimiento = `El activo "${activo.nombre}" cambió de estado de "${estadoAnterior}" a "${estado}"`;
    }

    if (oficina_id && oficina_id !== oficinaAnterior) {
      tipoMovimiento = "TRASLADO";
      descripcionMovimiento = `El activo "${activo.nombre}" fue trasladado de la oficina ID ${oficinaAnterior} a la oficina ID ${oficina_id}`;
    }

    await Movimiento.create({
      tipo: tipoMovimiento,
      descripcion: descripcionMovimiento,
      activo_id: activo.id,
      usuario_id: req.usuario.id,
    });
    return res.status(200).json({
      mensaje: "Activo actualizado correctamente",
      activo,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al actualizar el activo",
      error: error.message,
    });
  }
};

const eliminarActivo = async (req, res) => {
  try {
    const { id } = req.params;
    const activo = await Activo.findByPk(id);

    if (!activo) {
      return res.status(404).json({
        mensaje: "Activo no encontrado",
      });
    }
    await Movimiento.create({
      tipo: "BAJA",
      descripcion: `Se dio de baja el activo "${activo.nombre}"`,
      activo_id: activo.id,
      usuario_id: req.usuario.id,
    });

    await activo.update({
      activo: false,
      estado: "Dado de baja",
    });

    return res.status(200).json({
      mensaje: "Activo dado de baja correctamente",
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al eliminar el activo",
      error: error.message,
    });
  }
};

module.exports = {
  crearActivo,
  listarActivos,
  obtenerActivoPorId,
  actualizarActivo,
  eliminarActivo,
};
