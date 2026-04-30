const {
  PedidoInsumo,
  PedidoInsumoDetalle,
  ConsumoOficina,
  StockOficina,
  Insumo,
  Oficina,
} = require("../models");

const { esAdminGeneral } = require("../utils/permisos");

const validarMesAnio = (mes, anio) => {
  const mesNum = Number(mes);
  const anioNum = Number(anio);

  if (!Number.isInteger(mesNum) || mesNum < 1 || mesNum > 12) {
    return {
      valido: false,
      mensaje: "El mes debe ser un número entre 1 y 12",
    };
  }

  if (!Number.isInteger(anioNum) || anioNum < 2020 || anioNum > 2100) {
    return {
      valido: false,
      mensaje: "El año ingresado no es válido",
    };
  }

  return {
    valido: true,
    mesNum,
    anioNum,
  };
};

const obtenerReporteMensualOficina = async (req, res) => {
  try {
    const { oficina_id, mes, anio } = req.query;

    if (!oficina_id || !mes || !anio) {
      return res.status(400).json({
        mensaje: "Oficina, mes y año son obligatorios",
      });
    }

    const validacionFecha = validarMesAnio(mes, anio);

    if (!validacionFecha.valido) {
      return res.status(400).json({
        mensaje: validacionFecha.mensaje,
      });
    }

    const { mesNum, anioNum } = validacionFecha;

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
          mensaje: "No tenés permisos para consultar reportes de otra oficina",
        });
      }
    }

    const oficina = await Oficina.findByPk(oficinaPermitida);

    if (!oficina) {
      return res.status(404).json({
        mensaje: "Oficina no encontrada",
      });
    }

    const pedido = await PedidoInsumo.findOne({
      where: {
        oficina_id: oficinaPermitida,
        mes: mesNum,
        anio: anioNum,
      },
      include: [
        {
          model: PedidoInsumoDetalle,
          include: [
            {
              model: Insumo,
            },
          ],
        },
      ],
    });

    const consumos = await ConsumoOficina.findAll({
      where: {
        oficina_id: oficinaPermitida,
        mes: mesNum,
        anio: anioNum,
      },
      include: [
        {
          model: Insumo,
        },
      ],
    });

    const stockActual = await StockOficina.findAll({
      where: {
        oficina_id: oficinaPermitida,
      },
      include: [
        {
          model: Insumo,
        },
      ],
    });

    const mapa = {};

    const asegurarInsumo = (insumo) => {
      if (!insumo) return null;

      if (!mapa[insumo.id]) {
        mapa[insumo.id] = {
          insumo_id: insumo.id,
          nombre: insumo.nombre,
          categoria: insumo.categoria || "-",
          unidad_medida: insumo.unidad_medida || "-",
          cantidad_solicitada: 0,
          cantidad_provista: 0,
          cantidad_consumida: 0,
          stock_actual_oficina: 0,
        };
      }

      return mapa[insumo.id];
    };

    if (pedido?.PedidoInsumoDetalles) {
      pedido.PedidoInsumoDetalles.forEach((detalle) => {
        const fila = asegurarInsumo(detalle.Insumo);
        if (!fila) return;

        fila.cantidad_solicitada +=
          Number(detalle.cantidad_solicitada) || 0;

        fila.cantidad_provista += Number(detalle.cantidad_provista) || 0;
      });
    }

    consumos.forEach((consumo) => {
      const fila = asegurarInsumo(consumo.Insumo);
      if (!fila) return;

      fila.cantidad_consumida += Number(consumo.cantidad_consumida) || 0;
    });

    stockActual.forEach((stock) => {
      const fila = asegurarInsumo(stock.Insumo);
      if (!fila) return;

      fila.stock_actual_oficina += Number(stock.cantidad) || 0;
    });

    const detalle = Object.values(mapa).sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es")
    );

    const totales = detalle.reduce(
      (acc, item) => {
        acc.total_solicitado += Number(item.cantidad_solicitada) || 0;
        acc.total_provisto += Number(item.cantidad_provista) || 0;
        acc.total_consumido += Number(item.cantidad_consumida) || 0;
        acc.total_stock_actual += Number(item.stock_actual_oficina) || 0;

        return acc;
      },
      {
        total_solicitado: 0,
        total_provisto: 0,
        total_consumido: 0,
        total_stock_actual: 0,
      }
    );

    return res.status(200).json({
      oficina: {
        id: oficina.id,
        nombre: oficina.nombre,
      },
      periodo: {
        mes: mesNum,
        anio: anioNum,
      },
      pedido: pedido
        ? {
            id: pedido.id,
            estado: pedido.estado,
          }
        : null,
      totales,
      detalle,
    });
  } catch (error) {
    console.error("ERROR obtenerReporteMensualOficina:", error);

    return res.status(500).json({
      mensaje: "Error al obtener reporte mensual por oficina",
      error: error.message,
    });
  }
};

module.exports = {
  obtenerReporteMensualOficina,
};