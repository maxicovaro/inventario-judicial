const sequelize = require("../config/database");

const {
  ConsumoOficina,
  StockOficina,
  Insumo,
  Oficina,
  Usuario,
} = require("../models");

const { registrarBitacora } = require("../utils/bitacora");
const { esAdminGeneral } = require("../utils/permisos");

const crearError = (mensaje, status = 400) => {
  const error = new Error(mensaje);
  error.status = status;
  return error;
};

const resolverOficinaPermitida = (req, oficinaSolicitada) => {
  if (esAdminGeneral(req.usuario)) {
    return oficinaSolicitada;
  }

  return req.usuario.oficina_id;
};

const validarMesAnio = (mes, anio) => {
  const mesNum = Number(mes);
  const anioNum = Number(anio);

  if (!Number.isInteger(mesNum) || mesNum < 1 || mesNum > 12) {
    return "El mes debe ser un número entre 1 y 12";
  }

  if (!Number.isInteger(anioNum) || anioNum < 2020 || anioNum > 2100) {
    return "El año ingresado no es válido";
  }

  return null;
};

const registrarConsumoOficina = async (req, res) => {
  let transaction;

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

    if (!req.usuario.oficina_id && !esAdminGeneral(req.usuario)) {
      return res.status(400).json({
        mensaje: "El usuario no tiene oficina asignada",
      });
    }

    const oficinaPermitida = resolverOficinaPermitida(req, oficina_id);

    if (String(oficina_id) !== String(oficinaPermitida)) {
      return res.status(403).json({
        mensaje: "No tenés permisos para registrar consumo de otra oficina",
      });
    }

    const errorFecha = validarMesAnio(mes, anio);

    if (errorFecha) {
      return res.status(400).json({
        mensaje: errorFecha,
      });
    }

    const cantidadNum = Number(cantidad_consumida);

    if (!Number.isInteger(cantidadNum) || cantidadNum <= 0) {
      return res.status(400).json({
        mensaje: "La cantidad consumida debe ser un número entero mayor a 0",
      });
    }

    transaction = await sequelize.transaction();

    const oficina = await Oficina.findByPk(oficinaPermitida, {
      transaction,
    });

    if (!oficina) {
      throw crearError("Oficina no encontrada", 404);
    }

    const insumo = await Insumo.findByPk(insumo_id, {
      transaction,
    });

    if (!insumo) {
      throw crearError("Insumo no encontrado", 404);
    }

    if (insumo.activo === false) {
      throw crearError("No se puede registrar consumo de un insumo inactivo", 400);
    }

    const stockOficina = await StockOficina.findOne({
      where: {
        oficina_id: oficinaPermitida,
        insumo_id,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!stockOficina) {
      throw crearError(
        `La oficina "${oficina.nombre}" no tiene stock asignado de "${insumo.nombre}"`,
        400
      );
    }

    const stockDisponible = Number(stockOficina.cantidad) || 0;

    if (stockDisponible < cantidadNum) {
      throw crearError(
        `Stock insuficiente en la oficina. Disponible: ${stockDisponible}, requerido: ${cantidadNum}`,
        400
      );
    }

    const nuevoStockOficina = stockDisponible - cantidadNum;

    await stockOficina.update(
      {
        cantidad: nuevoStockOficina,
      },
      { transaction }
    );

    const consumo = await ConsumoOficina.create(
      {
        oficina_id: oficinaPermitida,
        insumo_id,
        usuario_id: req.usuario.id,
        mes: Number(mes),
        anio: Number(anio),
        cantidad_consumida: cantidadNum,
        observaciones: observaciones?.trim() || null,
      },
      { transaction }
    );

    await transaction.commit();
    transaction = null;

    try {
      await registrarBitacora({
        usuario_id: req.usuario.id,
        accion: "REGISTRAR_CONSUMO",
        modulo: "CONSUMO_OFICINA",
        descripcion: `Registró consumo de ${cantidadNum} unidad(es) de "${insumo.nombre}" en ${oficina.nombre} correspondiente a ${mes}/${anio}. Stock restante oficina: ${nuevoStockOficina}`,
      });
    } catch (errorBitacora) {
      console.error("Error al registrar bitácora:", errorBitacora);
    }

    const consumoCreado = await ConsumoOficina.findByPk(consumo.id, {
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
    });

    return res.status(201).json({
      mensaje: "Consumo registrado correctamente",
      consumo: consumoCreado,
      stock_oficina: nuevoStockOficina,
    });
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }

    console.error("ERROR registrarConsumoOficina:", error);

    return res.status(error.status || 500).json({
      mensaje: error.status
        ? error.message
        : "Error al registrar consumo de oficina",
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
      if (!req.usuario.oficina_id) {
        return res.status(400).json({
          mensaje: "El usuario no tiene oficina asignada",
        });
      }

      where.oficina_id = req.usuario.oficina_id;

      if (oficina_id && String(oficina_id) !== String(req.usuario.oficina_id)) {
        return res.status(403).json({
          mensaje: "No tenés permisos para consultar consumos de otra oficina",
        });
      }
    }

    if (mes) {
      const mesNum = Number(mes);

      if (!Number.isInteger(mesNum) || mesNum < 1 || mesNum > 12) {
        return res.status(400).json({
          mensaje: "El mes debe ser un número entre 1 y 12",
        });
      }

      where.mes = mesNum;
    }

    if (anio) {
      const anioNum = Number(anio);

      if (!Number.isInteger(anioNum) || anioNum < 2020 || anioNum > 2100) {
        return res.status(400).json({
          mensaje: "El año ingresado no es válido",
        });
      }

      where.anio = anioNum;
    }

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

    if (!oficina_id) {
      return res.status(400).json({
        mensaje: "Debe indicar una oficina",
      });
    }

    let oficinaPermitida = oficina_id;

    if (!esAdminGeneral(req.usuario)) {
      if (!req.usuario.oficina_id) {
        return res.status(400).json({
          mensaje: "El usuario no tiene oficina asignada",
        });
      }

      oficinaPermitida = req.usuario.oficina_id;

      if (String(oficina_id) !== String(req.usuario.oficina_id)) {
        return res.status(403).json({
          mensaje: "No tenés permisos para consultar resumen de otra oficina",
        });
      }
    }

    const oficina = await Oficina.findByPk(oficinaPermitida);

    if (!oficina) {
      return res.status(404).json({
        mensaje: "Oficina no encontrada",
      });
    }

    const where = {
      oficina_id: oficinaPermitida,
    };

    if (mes) {
      const mesNum = Number(mes);

      if (!Number.isInteger(mesNum) || mesNum < 1 || mesNum > 12) {
        return res.status(400).json({
          mensaje: "El mes debe ser un número entre 1 y 12",
        });
      }

      where.mes = mesNum;
    }

    if (anio) {
      const anioNum = Number(anio);

      if (!Number.isInteger(anioNum) || anioNum < 2020 || anioNum > 2100) {
        return res.status(400).json({
          mensaje: "El año ingresado no es válido",
        });
      }

      where.anio = anioNum;
    }

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