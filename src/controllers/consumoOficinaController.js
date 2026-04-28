const {
  ConsumoOficina,
  StockOficina,
  Insumo,
  Oficina,
  Usuario,
} = require("../models");

const { registrarBitacora } = require("../utils/bitacora");
const { esAdminGeneral } = require("../utils/permisos");

const resolverOficinaPermitida = (req, oficinaSolicitada) => {
  if (esAdminGeneral(req.usuario)) {
    return oficinaSolicitada;
  }

  return req.usuario.oficina_id;
};

const registrarConsumoOficina = async (req, res) => {
  try {
    const {
      oficina_id,
      insumo_id,
      mes,
      anio,
      cantidad_consumida,
      observaciones,
    } = req.body;

    if (!oficina_id || !insumo_id || !mes || !anio || !cantidad_consumida) {
      return res.status(400).json({
        mensaje:
          "Oficina, insumo, mes, año y cantidad consumida son obligatorios",
      });
    }

    const oficinaPermitida = resolverOficinaPermitida(req, oficina_id);

    if (String(oficina_id) !== String(oficinaPermitida)) {
      return res.status(403).json({
        mensaje: "No tenés permisos para registrar consumo de otra oficina",
      });
    }

    const cantidadNum = Number(cantidad_consumida);

    if (!Number.isInteger(cantidadNum) || cantidadNum <= 0) {
      return res.status(400).json({
        mensaje: "La cantidad consumida debe ser un número entero mayor a 0",
      });
    }

    const oficina = await Oficina.findByPk(oficinaPermitida);

    if (!oficina) {
      return res.status(404).json({
        mensaje: "Oficina no encontrada",
      });
    }

    const insumo = await Insumo.findByPk(insumo_id);

    if (!insumo) {
      return res.status(404).json({
        mensaje: "Insumo no encontrado",
      });
    }

    const stockOficina = await StockOficina.findOne({
      where: {
        oficina_id: oficinaPermitida,
        insumo_id,
      },
    });

    if (!stockOficina) {
      return res.status(400).json({
        mensaje: `La oficina "${oficina.nombre}" no tiene stock asignado de "${insumo.nombre}"`,
      });
    }

    if (Number(stockOficina.cantidad) < cantidadNum) {
      return res.status(400).json({
        mensaje: `Stock insuficiente en la oficina. Disponible: ${stockOficina.cantidad}, requerido: ${cantidadNum}`,
      });
    }

    await stockOficina.update({
      cantidad: Number(stockOficina.cantidad) - cantidadNum,
    });

    const consumo = await ConsumoOficina.create({
      oficina_id: oficinaPermitida,
      insumo_id,
      usuario_id: req.usuario.id,
      mes,
      anio,
      cantidad_consumida: cantidadNum,
      observaciones: observaciones || null,
    });

    await registrarBitacora({
      usuario_id: req.usuario.id,
      accion: "REGISTRAR_CONSUMO",
      modulo: "CONSUMO_OFICINA",
      descripcion: `Registró consumo de ${cantidadNum} unidad(es) de "${insumo.nombre}" en ${oficina.nombre} correspondiente a ${mes}/${anio}`,
    });

    return res.status(201).json({
      mensaje: "Consumo registrado correctamente",
      consumo,
    });
  } catch (error) {
    console.error("ERROR registrarConsumoOficina:", error);

    return res.status(500).json({
      mensaje: "Error al registrar consumo de oficina",
      error: error.message,
    });
  }
};

const listarConsumosOficina = async (req, res) => {
  try {
    const { oficina_id, mes, anio } = req.query;

    const where = {};

    if (esAdminGeneral(req.usuario)) {
      if (oficina_id) where.oficina_id = oficina_id;
    } else {
      where.oficina_id = req.usuario.oficina_id;

      if (oficina_id && String(oficina_id) !== String(req.usuario.oficina_id)) {
        return res.status(403).json({
          mensaje: "No tenés permisos para consultar consumos de otra oficina",
        });
      }
    }

    if (mes) where.mes = mes;
    if (anio) where.anio = anio;

    const consumos = await ConsumoOficina.findAll({
      where,
      include: [
        {
          model: Oficina,
          attributes: ["id", "nombre"],
        },
        {
          model: Insumo,
          attributes: ["id", "nombre", "categoria", "unidad_medida"],
        },
        {
          model: Usuario,
          attributes: ["id", "nombre", "apellido", "email"],
        },
      ],
      order: [["id", "DESC"]],
    });

    return res.status(200).json(consumos);
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al listar consumos de oficina",
      error: error.message,
    });
  }
};

const obtenerResumenConsumoPorOficina = async (req, res) => {
  try {
    const { oficina_id } = req.params;
    const { mes, anio } = req.query;

    let oficinaPermitida = oficina_id;

    if (!esAdminGeneral(req.usuario)) {
      oficinaPermitida = req.usuario.oficina_id;

      if (String(oficina_id) !== String(req.usuario.oficina_id)) {
        return res.status(403).json({
          mensaje: "No tenés permisos para consultar resumen de otra oficina",
        });
      }
    }

    const where = { oficina_id: oficinaPermitida };

    if (mes) where.mes = mes;
    if (anio) where.anio = anio;

    const consumos = await ConsumoOficina.findAll({
      where,
      include: [
        {
          model: Insumo,
          attributes: ["id", "nombre", "categoria", "unidad_medida"],
        },
      ],
      order: [["id", "DESC"]],
    });

    const resumen = consumos.reduce((acc, item) => {
      const insumoId = item.insumo_id;

      if (!acc[insumoId]) {
        acc[insumoId] = {
          insumo_id: insumoId,
          nombre: item.Insumo?.nombre || "-",
          categoria: item.Insumo?.categoria || "-",
          unidad_medida: item.Insumo?.unidad_medida || "-",
          total_consumido: 0,
        };
      }

      acc[insumoId].total_consumido += Number(item.cantidad_consumida) || 0;

      return acc;
    }, {});

    return res.status(200).json(Object.values(resumen));
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al obtener resumen de consumo",
      error: error.message,
    });
  }
};

module.exports = {
  registrarConsumoOficina,
  listarConsumosOficina,
  obtenerResumenConsumoPorOficina,
};