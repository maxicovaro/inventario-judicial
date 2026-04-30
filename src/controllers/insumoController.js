const { Op } = require("sequelize");
const { Insumo } = require("../models");
const { registrarBitacora } = require("../utils/bitacora");
const { esAdminGeneral } = require("../utils/permisos");

const exigirAdminGeneral = (req, res) => {
  if (!esAdminGeneral(req.usuario)) {
    res.status(403).json({
      mensaje:
        "Acceso denegado. Solo Dirección de Policía Judicial puede administrar insumos del stock central.",
    });

    return false;
  }

  return true;
};

const normalizarTexto = (valor) => {
  if (valor === undefined || valor === null) return null;

  const texto = String(valor).trim();

  return texto === "" ? null : texto;
};

const convertirNumeroNoNegativo = (valor, campo) => {
  if (valor === undefined || valor === null || valor === "") {
    return 0;
  }

  const numero = Number(valor);

  if (Number.isNaN(numero)) {
    const error = new Error(`${campo} debe ser un número válido`);
    error.status = 400;
    throw error;
  }

  if (numero < 0) {
    const error = new Error(`${campo} no puede ser negativo`);
    error.status = 400;
    throw error;
  }

  return numero;
};

const listarInsumos = async (req, res) => {
  try {
    const esDireccion = esAdminGeneral(req.usuario);

    if (esDireccion) {
      const insumos = await Insumo.findAll({
        order: [["id", "DESC"]],
      });

      return res.status(200).json(insumos);
    }

    const insumos = await Insumo.findAll({
      where: {
        activo: true,
      },
      attributes: ["id", "nombre", "categoria", "unidad_medida", "activo"],
      order: [["nombre", "ASC"]],
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
    if (!exigirAdminGeneral(req, res)) return;

    const {
      nombre,
      categoria,
      unidad_medida,
      stock_actual,
      stock_minimo,
      proveedor,
      activo,
    } = req.body;

    const nombreNormalizado = normalizarTexto(nombre);

    if (!nombreNormalizado) {
      return res.status(400).json({
        mensaje: "El nombre del insumo es obligatorio",
      });
    }

    const existe = await Insumo.findOne({
      where: {
        nombre: nombreNormalizado,
      },
    });

    if (existe) {
      return res.status(400).json({
        mensaje: "Ya existe un insumo con ese nombre",
      });
    }

    const stockActualFinal = convertirNumeroNoNegativo(
      stock_actual,
      "El stock actual"
    );

    const stockMinimoFinal = convertirNumeroNoNegativo(
      stock_minimo,
      "El stock mínimo"
    );

    const insumo = await Insumo.create({
      nombre: nombreNormalizado,
      categoria: normalizarTexto(categoria),
      unidad_medida: normalizarTexto(unidad_medida),
      stock_actual: stockActualFinal,
      stock_minimo: stockMinimoFinal,
      proveedor: normalizarTexto(proveedor),
      activo: activo !== undefined ? Boolean(activo) : true,
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
    return res.status(error.status || 500).json({
      mensaje: error.status ? error.message : "Error al crear insumo",
      error: error.message,
    });
  }
};

const actualizarInsumo = async (req, res) => {
  try {
    if (!exigirAdminGeneral(req, res)) return;

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

    const datosActualizados = {};

    if (nombre !== undefined) {
      const nombreNormalizado = normalizarTexto(nombre);

      if (!nombreNormalizado) {
        return res.status(400).json({
          mensaje: "El nombre del insumo es obligatorio",
        });
      }

      if (nombreNormalizado !== insumo.nombre) {
        const existe = await Insumo.findOne({
          where: {
            nombre: nombreNormalizado,
            id: {
              [Op.ne]: insumo.id,
            },
          },
        });

        if (existe) {
          return res.status(400).json({
            mensaje: "Ya existe un insumo con ese nombre",
          });
        }
      }

      datosActualizados.nombre = nombreNormalizado;
    }

    if (categoria !== undefined) {
      datosActualizados.categoria = normalizarTexto(categoria);
    }

    if (unidad_medida !== undefined) {
      datosActualizados.unidad_medida = normalizarTexto(unidad_medida);
    }

    if (stock_actual !== undefined) {
      datosActualizados.stock_actual = convertirNumeroNoNegativo(
        stock_actual,
        "El stock actual"
      );
    }

    if (stock_minimo !== undefined) {
      datosActualizados.stock_minimo = convertirNumeroNoNegativo(
        stock_minimo,
        "El stock mínimo"
      );
    }

    if (proveedor !== undefined) {
      datosActualizados.proveedor = normalizarTexto(proveedor);
    }

    if (activo !== undefined) {
      datosActualizados.activo = Boolean(activo);
    }

    await insumo.update(datosActualizados);

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
    return res.status(error.status || 500).json({
      mensaje: error.status ? error.message : "Error al actualizar insumo",
      error: error.message,
    });
  }
};

module.exports = {
  listarInsumos,
  crearInsumo,
  actualizarInsumo,
};