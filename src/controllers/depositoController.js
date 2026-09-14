const { Op } = require("sequelize");
const sequelize = require("../config/database");
const {
  Activo,
  Categoria,
  Oficina,
  Movimiento,
  Insumo,
  MovimientoStock,
  Usuario,
  Solicitud,
  PedidoInsumo,
  PedidoInsumoDetalle,
} = require("../models");
const { registrarBitacora } = require("../utils/bitacora");
const { crearNotificacion } = require("../utils/notificaciones");
const {
  iniciarTransaccionIdempotente,
  completarIdempotencia,
  responderReplay,
} = require("../utils/idempotencia");
const {
  ESTADOS_VALIDOS,
  validarTransicionEstado,
} = require("../utils/pedidoRules");
const { asignarStockAOficina } = require("./stockOficinaController");
const { actualizarProvision } = require("./pedidoInsumoController");

const ESTADOS_ACTIVO = new Set([
  "Excelente estado",
  "Buen estado",
  "Regular estado",
  "Mal estado",
  "Sin funcionar",
]);
const TIPOS_MOVIMIENTO_CENTRAL = new Set(["INGRESO", "DEVOLUCION", "AJUSTE"]);
const ESTADOS_SOLICITUD = new Set([
  "PENDIENTE",
  "APROBADA",
  "RECHAZADA",
  "EN_PROCESO",
  "FINALIZADA",
]);

const textoOpcional = (valor) => {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  return texto || null;
};

const enteroPositivo = (valor, campo) => {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    const error = new Error(`${campo} debe ser un número entero mayor a 0`);
    error.status = 400;
    throw error;
  }
  return numero;
};

const enteroNoNegativo = (valor, campo, fallback = 0) => {
  if (valor === undefined || valor === null || valor === "") return fallback;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 0) {
    const error = new Error(`${campo} debe ser un número entero igual o mayor a 0`);
    error.status = 400;
    throw error;
  }
  return numero;
};

const obtenerDepositoCentral = async (options = {}) => {
  const deposito = await Oficina.findOne({
    where: { es_deposito_central: true },
    ...options,
  });

  if (!deposito) {
    const error = new Error("No existe una oficina configurada como Depósito Central");
    error.status = 503;
    throw error;
  }

  return deposito;
};

const registrarBitacoraSegura = async (datos) => {
  try {
    await registrarBitacora(datos);
  } catch (error) {
    console.error("Error al registrar bitácora de Depósito Central:", error);
  }
};

const obtenerContexto = async (req, res) => {
  try {
    const [deposito, oficinaGestora] = await Promise.all([
      obtenerDepositoCentral({
        attributes: ["id", "nombre", "descripcion", "es_deposito_central"],
      }),
      Oficina.findByPk(req.usuario.oficina_id, {
        attributes: ["id", "nombre", "descripcion", "gestiona_deposito"],
      }),
    ]);

    return res.status(200).json({
      deposito,
      oficina_gestora: oficinaGestora,
      usuario: {
        id: req.usuario.id,
        role: req.usuario.role,
        oficina_id: req.usuario.oficina_id,
      },
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      mensaje: error.status ? error.message : "Error al obtener contexto del depósito",
    });
  }
};

const listarActivosDeposito = async (req, res) => {
  try {
    const deposito = await obtenerDepositoCentral();
    const activos = await Activo.findAll({
      where: { oficina_id: deposito.id },
      include: [
        { model: Categoria, attributes: ["id", "nombre"] },
        { model: Oficina, attributes: ["id", "nombre"] },
      ],
      order: [["id", "DESC"]],
    });

    return res.status(200).json({ deposito, activos });
  } catch (error) {
    return res.status(error.status || 500).json({
      mensaje: error.status ? error.message : "Error al listar activos del depósito",
    });
  }
};

const crearActivoDeposito = async (req, res) => {
  let transaction;
  let operacionIdempotente;

  try {
    const {
      nombre,
      descripcion,
      codigo_interno,
      marca,
      modelo,
      numero_serie,
      cantidad,
      categoria_id,
      estado,
      fecha_alta,
      observaciones,
    } = req.body;

    if (!nombre || !categoria_id) {
      return res.status(400).json({ mensaje: "Nombre y categoría son obligatorios" });
    }
    if (estado && !ESTADOS_ACTIVO.has(estado)) {
      return res.status(400).json({ mensaje: "Estado de activo inválido" });
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "oficina_id")) {
      return res.status(400).json({
        mensaje: "La ubicación del alta de depósito se determina automáticamente",
      });
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "activo")) {
      return res.status(400).json({
        mensaje: "El campo activo no puede modificarse desde Depósito Central",
      });
    }

    const inicio = await iniciarTransaccionIdempotente({
      sequelize,
      req,
      scope: "deposito:activo:create",
    });
    if (inicio.replay) return responderReplay(res, inicio.replay);

    transaction = inicio.transaction;
    operacionIdempotente = inicio.operacion;

    const deposito = await obtenerDepositoCentral({ transaction });
    const categoria = await Categoria.findByPk(categoria_id, { transaction });
    if (!categoria) {
      await transaction.rollback();
      transaction = null;
      return res.status(404).json({ mensaje: "Categoría no encontrada" });
    }

    const codigo = textoOpcional(codigo_interno);
    if (codigo) {
      const existente = await Activo.findOne({
        where: { codigo_interno: codigo },
        transaction,
      });
      if (existente) {
        await transaction.rollback();
        transaction = null;
        return res.status(409).json({ mensaje: "Ya existe un activo con ese código interno" });
      }
    }

    const activo = await Activo.create(
      {
        nombre: String(nombre).trim(),
        descripcion: textoOpcional(descripcion),
        codigo_interno: codigo,
        marca: textoOpcional(marca),
        modelo: textoOpcional(modelo),
        numero_serie: textoOpcional(numero_serie),
        cantidad: enteroPositivo(cantidad || 1, "La cantidad"),
        categoria_id: categoria.id,
        oficina_id: deposito.id,
        estado: estado || "Buen estado",
        fecha_alta: fecha_alta || null,
        observaciones: textoOpcional(observaciones),
        activo: true,
      },
      { transaction },
    );

    await Movimiento.create(
      {
        activo_id: activo.id,
        usuario_id: req.usuario.id,
        tipo: "ALTA",
        descripcion: `Alta del activo en ${deposito.nombre}`,
        fecha: new Date(),
      },
      { transaction },
    );

    const respuesta = {
      mensaje: "Activo ingresado al Depósito Central",
      activo,
      deposito: { id: deposito.id, nombre: deposito.nombre },
    };
    await completarIdempotencia({
      operacion: operacionIdempotente,
      transaction,
      status: 201,
      body: respuesta,
    });
    await transaction.commit();
    transaction = null;

    await registrarBitacoraSegura({
      usuario_id: req.usuario.id,
      accion: "ALTA_DEPOSITO",
      modulo: "ACTIVOS",
      descripcion: `Ingresó al Depósito Central el activo ${activo.nombre}${codigo ? ` (${codigo})` : ""}`,
    });

    return res.status(201).json(respuesta);
  } catch (error) {
    if (transaction) await transaction.rollback();
    if (
      error.name === "SequelizeUniqueConstraintError" ||
      error.original?.code === "ER_DUP_ENTRY"
    ) {
      return res.status(409).json({ mensaje: "Ya existe un activo con ese código interno" });
    }
    return res.status(error.status || 500).json({
      mensaje: error.status ? error.message : "Error al ingresar activo al depósito",
    });
  }
};

const actualizarActivoDeposito = async (req, res) => {
  let transaction;
  let operacionIdempotente;

  try {
    if (
      Object.prototype.hasOwnProperty.call(req.body, "oficina_id") ||
      Object.prototype.hasOwnProperty.call(req.body, "activo")
    ) {
      return res.status(400).json({
        mensaje: "Ubicación y baja no se modifican desde la edición del depósito",
      });
    }

    const inicio = await iniciarTransaccionIdempotente({
      sequelize,
      req,
      scope: "deposito:activo:update",
    });
    if (inicio.replay) return responderReplay(res, inicio.replay);

    transaction = inicio.transaction;
    operacionIdempotente = inicio.operacion;
    const deposito = await obtenerDepositoCentral({ transaction });
    const activo = await Activo.findOne({
      where: { id: req.params.id, oficina_id: deposito.id, activo: true },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!activo) {
      await transaction.rollback();
      transaction = null;
      return res.status(404).json({ mensaje: "Activo no encontrado en Depósito Central" });
    }

    const datos = {};
    const camposTexto = [
      "descripcion",
      "marca",
      "modelo",
      "numero_serie",
      "observaciones",
    ];
    if (req.body.nombre !== undefined) {
      const nombre = String(req.body.nombre).trim();
      if (!nombre) {
        await transaction.rollback();
        transaction = null;
        return res.status(400).json({ mensaje: "El nombre es obligatorio" });
      }
      datos.nombre = nombre;
    }
    for (const campo of camposTexto) {
      if (req.body[campo] !== undefined) datos[campo] = textoOpcional(req.body[campo]);
    }
    if (req.body.cantidad !== undefined) {
      datos.cantidad = enteroPositivo(req.body.cantidad, "La cantidad");
    }
    if (req.body.estado !== undefined) {
      if (!ESTADOS_ACTIVO.has(req.body.estado)) {
        await transaction.rollback();
        transaction = null;
        return res.status(400).json({ mensaje: "Estado de activo inválido" });
      }
      datos.estado = req.body.estado;
    }
    if (req.body.fecha_alta !== undefined) datos.fecha_alta = req.body.fecha_alta || null;
    if (req.body.categoria_id !== undefined) {
      const categoria = await Categoria.findByPk(req.body.categoria_id, { transaction });
      if (!categoria) {
        await transaction.rollback();
        transaction = null;
        return res.status(404).json({ mensaje: "Categoría no encontrada" });
      }
      datos.categoria_id = categoria.id;
    }
    if (req.body.codigo_interno !== undefined) {
      const codigo = textoOpcional(req.body.codigo_interno);
      if (codigo && codigo !== activo.codigo_interno) {
        const existente = await Activo.findOne({
          where: { codigo_interno: codigo, id: { [Op.ne]: activo.id } },
          transaction,
        });
        if (existente) {
          await transaction.rollback();
          transaction = null;
          return res.status(409).json({ mensaje: "Ya existe un activo con ese código interno" });
        }
      }
      datos.codigo_interno = codigo;
    }

    await activo.update(datos, { transaction });
    await Movimiento.create(
      {
        activo_id: activo.id,
        usuario_id: req.usuario.id,
        tipo: "ACTUALIZACION",
        descripcion: "Actualización de datos mientras el activo permanece en Depósito Central",
        fecha: new Date(),
      },
      { transaction },
    );

    const respuesta = { mensaje: "Activo de depósito actualizado correctamente", activo };
    await completarIdempotencia({
      operacion: operacionIdempotente,
      transaction,
      status: 200,
      body: respuesta,
    });
    await transaction.commit();
    transaction = null;

    await registrarBitacoraSegura({
      usuario_id: req.usuario.id,
      accion: "EDITAR_DEPOSITO",
      modulo: "ACTIVOS",
      descripcion: `Editó el activo de depósito ${activo.nombre}`,
    });

    return res.status(200).json(respuesta);
  } catch (error) {
    if (transaction) await transaction.rollback();
    return res.status(error.status || 500).json({
      mensaje: error.status ? error.message : "Error al actualizar activo del depósito",
    });
  }
};

const transferirActivoDeposito = async (req, res) => {
  let transaction;
  let operacionIdempotente;

  try {
    const oficinaDestinoId = enteroPositivo(
      req.body.oficina_destino_id,
      "La oficina destino",
    );
    const inicio = await iniciarTransaccionIdempotente({
      sequelize,
      req,
      scope: "deposito:activo:transferir",
    });
    if (inicio.replay) return responderReplay(res, inicio.replay);

    transaction = inicio.transaction;
    operacionIdempotente = inicio.operacion;
    const deposito = await obtenerDepositoCentral({ transaction });
    const activo = await Activo.findOne({
      where: { id: req.params.id, oficina_id: deposito.id, activo: true },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!activo) {
      await transaction.rollback();
      transaction = null;
      return res.status(404).json({ mensaje: "Activo no encontrado en Depósito Central" });
    }

    const oficinaDestino = await Oficina.findByPk(oficinaDestinoId, { transaction });
    if (!oficinaDestino) {
      await transaction.rollback();
      transaction = null;
      return res.status(404).json({ mensaje: "Oficina destino no encontrada" });
    }
    if (oficinaDestino.es_deposito_central) {
      await transaction.rollback();
      transaction = null;
      return res.status(400).json({ mensaje: "El activo ya se encuentra en el Depósito Central" });
    }

    await activo.update({ oficina_id: oficinaDestino.id }, { transaction });
    await Movimiento.create(
      {
        activo_id: activo.id,
        usuario_id: req.usuario.id,
        tipo: "TRASLADO",
        descripcion: `Entrega desde ${deposito.nombre} a ${oficinaDestino.nombre}`,
        fecha: new Date(),
      },
      { transaction },
    );

    const respuesta = {
      mensaje: "Activo entregado a la oficina destino",
      activo,
      origen: { id: deposito.id, nombre: deposito.nombre },
      destino: { id: oficinaDestino.id, nombre: oficinaDestino.nombre },
    };
    await completarIdempotencia({
      operacion: operacionIdempotente,
      transaction,
      status: 200,
      body: respuesta,
    });
    await transaction.commit();
    transaction = null;

    await registrarBitacoraSegura({
      usuario_id: req.usuario.id,
      accion: "ENTREGAR_ACTIVO",
      modulo: "ACTIVOS",
      descripcion: `Entregó ${activo.nombre} desde Depósito Central a ${oficinaDestino.nombre}`,
    });

    return res.status(200).json(respuesta);
  } catch (error) {
    if (transaction) await transaction.rollback();
    return res.status(error.status || 500).json({
      mensaje: error.status ? error.message : "Error al transferir activo del depósito",
    });
  }
};

const listarInsumosDeposito = async (req, res) => {
  try {
    const insumos = await Insumo.findAll({ order: [["nombre", "ASC"]] });
    return res.status(200).json(insumos);
  } catch (error) {
    return res.status(500).json({ mensaje: "Error al listar insumos del depósito" });
  }
};

const crearInsumoDeposito = async (req, res) => {
  try {
    const nombre = textoOpcional(req.body.nombre);
    if (!nombre) return res.status(400).json({ mensaje: "El nombre es obligatorio" });

    const existente = await Insumo.findOne({ where: { nombre } });
    if (existente) {
      return res.status(409).json({ mensaje: "Ya existe un insumo con ese nombre" });
    }

    const insumo = await Insumo.create({
      nombre,
      descripcion: textoOpcional(req.body.descripcion),
      categoria: textoOpcional(req.body.categoria),
      unidad_medida: req.body.unidad_medida || "unidad",
      stock_actual: enteroNoNegativo(req.body.stock_actual, "El stock actual"),
      stock_minimo: enteroNoNegativo(req.body.stock_minimo, "El stock mínimo"),
      lote: textoOpcional(req.body.lote),
      fecha_vencimiento: req.body.fecha_vencimiento || null,
      proveedor: textoOpcional(req.body.proveedor),
      observaciones: textoOpcional(req.body.observaciones),
      activo: req.body.activo !== undefined ? Boolean(req.body.activo) : true,
    });

    await registrarBitacoraSegura({
      usuario_id: req.usuario.id,
      accion: "CREAR",
      modulo: "INSUMOS",
      descripcion: `Creó el insumo de Depósito Central ${insumo.nombre}`,
    });
    return res.status(201).json({ mensaje: "Insumo creado correctamente", insumo });
  } catch (error) {
    return res.status(error.status || 500).json({
      mensaje: error.status ? error.message : "Error al crear insumo de depósito",
    });
  }
};

const listarMovimientosDeposito = async (req, res) => {
  try {
    const movimientos = await MovimientoStock.findAll({
      include: [
        { model: Insumo, attributes: ["id", "nombre", "categoria"] },
        { model: Usuario, attributes: ["id", "nombre", "apellido"] },
        { model: Oficina, attributes: ["id", "nombre"] },
      ],
      order: [["fecha", "DESC"]],
      limit: 500,
    });
    return res.status(200).json(movimientos);
  } catch (error) {
    return res.status(500).json({ mensaje: "Error al listar movimientos del depósito" });
  }
};

const registrarMovimientoDeposito = async (req, res) => {
  let transaction;
  let operacionIdempotente;

  try {
    const { insumo_id, tipo, cantidad, motivo } = req.body;
    if (!insumo_id || !tipo || cantidad === undefined) {
      return res.status(400).json({ mensaje: "Insumo, tipo y cantidad son obligatorios" });
    }
    if (!TIPOS_MOVIMIENTO_CENTRAL.has(tipo)) {
      return res.status(400).json({
        mensaje: "Desde esta acción solo se permiten INGRESO, DEVOLUCION o AJUSTE; las entregas se realizan mediante distribución a oficina",
      });
    }

    const cantidadNum = enteroNoNegativo(cantidad, "La cantidad");
    if ((tipo === "INGRESO" || tipo === "DEVOLUCION") && cantidadNum === 0) {
      return res.status(400).json({ mensaje: "La cantidad debe ser mayor a 0" });
    }

    const inicio = await iniciarTransaccionIdempotente({
      sequelize,
      req,
      scope: "deposito:insumo:movimiento",
    });
    if (inicio.replay) return responderReplay(res, inicio.replay);

    transaction = inicio.transaction;
    operacionIdempotente = inicio.operacion;
    const insumo = await Insumo.findByPk(insumo_id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!insumo || insumo.activo === false) {
      await transaction.rollback();
      transaction = null;
      return res.status(404).json({ mensaje: "Insumo activo no encontrado" });
    }

    const stockAnterior = Number(insumo.stock_actual) || 0;
    const nuevoStock = tipo === "AJUSTE" ? cantidadNum : stockAnterior + cantidadNum;
    await insumo.update({ stock_actual: nuevoStock }, { transaction });
    const movimiento = await MovimientoStock.create(
      {
        insumo_id: insumo.id,
        tipo,
        cantidad: cantidadNum,
        motivo: textoOpcional(motivo),
        fecha: new Date(),
        usuario_id: req.usuario.id,
        oficina_id: null,
      },
      { transaction },
    );

    const respuesta = {
      mensaje: "Movimiento de Depósito Central registrado",
      movimiento,
      stock_anterior: stockAnterior,
      stock_actual: nuevoStock,
    };
    await completarIdempotencia({
      operacion: operacionIdempotente,
      transaction,
      status: 201,
      body: respuesta,
    });
    await transaction.commit();
    transaction = null;

    await registrarBitacoraSegura({
      usuario_id: req.usuario.id,
      accion: "MOVIMIENTO_DEPOSITO",
      modulo: "INSUMOS",
      descripcion: `${tipo} de ${cantidadNum} unidad(es) de ${insumo.nombre}. Stock central: ${nuevoStock}`,
    });
    return res.status(201).json(respuesta);
  } catch (error) {
    if (transaction) await transaction.rollback();
    return res.status(error.status || 500).json({
      mensaje: error.status ? error.message : "Error al registrar movimiento de depósito",
    });
  }
};

const asignarStockDeposito = async (req, res) => asignarStockAOficina(req, res);

const listarSolicitudesDeposito = async (req, res) => {
  try {
    const solicitudes = await Solicitud.findAll({
      include: [
        { model: Usuario, attributes: ["id", "nombre", "apellido", "email"] },
        { model: Oficina, attributes: ["id", "nombre"] },
        { model: Activo, attributes: ["id", "nombre", "codigo_interno", "oficina_id"] },
      ],
      order: [["id", "DESC"]],
    });
    return res.status(200).json(solicitudes);
  } catch (error) {
    return res.status(500).json({ mensaje: "Error al listar solicitudes institucionales" });
  }
};

const responderSolicitudDeposito = async (req, res) => {
  try {
    const solicitud = await Solicitud.findByPk(req.params.id);
    if (!solicitud) return res.status(404).json({ mensaje: "Solicitud no encontrada" });

    const datos = {};
    if (req.body.estado !== undefined) {
      if (!ESTADOS_SOLICITUD.has(req.body.estado)) {
        return res.status(400).json({ mensaje: "Estado de solicitud inválido" });
      }
      datos.estado = req.body.estado;
    }
    if (req.body.respuesta_admin !== undefined) {
      datos.respuesta_admin = textoOpcional(req.body.respuesta_admin);
    }
    if (Object.keys(datos).length === 0) {
      return res.status(400).json({ mensaje: "Debe indicar estado y/o respuesta" });
    }

    const estadoAnterior = solicitud.estado;
    await solicitud.update(datos);

    if (datos.estado && datos.estado !== estadoAnterior) {
      await crearNotificacion({
        usuario_id: solicitud.usuario_id,
        titulo: "Actualización de solicitud",
        mensaje: `Tu solicitud #${solicitud.id} cambió a estado ${datos.estado}.`,
      });
    }

    await registrarBitacoraSegura({
      usuario_id: req.usuario.id,
      accion: "RESPONDER_SOLICITUD",
      modulo: "SOLICITUDES",
      descripcion: `Gestionó la solicitud #${solicitud.id}${datos.estado ? ` (${estadoAnterior} -> ${datos.estado})` : ""}`,
    });

    return res.status(200).json({
      mensaje: "Solicitud gestionada correctamente",
      solicitud,
    });
  } catch (error) {
    return res.status(500).json({ mensaje: "Error al gestionar la solicitud" });
  }
};

const listarPedidosDeposito = async (req, res) => {
  try {
    const pedidos = await PedidoInsumo.findAll({
      include: [
        { model: Usuario, attributes: ["id", "nombre", "apellido"] },
        { model: Oficina, attributes: ["id", "nombre"] },
        {
          model: PedidoInsumoDetalle,
          include: [{ model: Insumo, attributes: ["id", "nombre"] }],
        },
      ],
      order: [["id", "DESC"]],
    });
    return res.status(200).json(pedidos);
  } catch (error) {
    return res.status(500).json({ mensaje: "Error al listar pedidos del depósito" });
  }
};

const proveerPedidoDeposito = async (req, res) => actualizarProvision(req, res);

const actualizarEstadoPedidoDeposito = async (req, res) => {
  let transaction;
  let operacionIdempotente;

  try {
    const { estado } = req.body;
    if (!estado || !ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ mensaje: "Estado inválido" });
    }
    if (estado === "ENTREGADO") {
      return res.status(400).json({
        mensaje: "ENTREGADO debe registrarse mediante la provisión del pedido",
      });
    }

    const inicio = await iniciarTransaccionIdempotente({
      sequelize,
      req,
      scope: "deposito:pedido:estado",
    });
    if (inicio.replay) return responderReplay(res, inicio.replay);

    transaction = inicio.transaction;
    operacionIdempotente = inicio.operacion;
    const pedido = await PedidoInsumo.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!pedido) {
      await transaction.rollback();
      transaction = null;
      return res.status(404).json({ mensaje: "Pedido no encontrado" });
    }

    const anterior = pedido.estado;
    if (!validarTransicionEstado(anterior, estado)) {
      await transaction.rollback();
      transaction = null;
      return res.status(409).json({
        mensaje: `Transición de estado no permitida: ${anterior} -> ${estado}`,
      });
    }
    if (anterior !== estado) await pedido.update({ estado }, { transaction });

    const respuesta = { mensaje: "Estado actualizado correctamente", pedido };
    await completarIdempotencia({
      operacion: operacionIdempotente,
      transaction,
      status: 200,
      body: respuesta,
    });
    await transaction.commit();
    transaction = null;

    if (anterior !== estado) {
      try {
        await crearNotificacion({
          usuario_id: pedido.usuario_id,
          titulo: "Actualización de pedido mensual",
          mensaje: `Tu pedido mensual N° ${pedido.id} ahora se encuentra en estado: ${estado}.`,
        });
      } catch (errorNotificacion) {
        console.error("Error al notificar estado de pedido:", errorNotificacion);
      }
      await registrarBitacoraSegura({
        usuario_id: req.usuario.id,
        accion: "CAMBIAR_ESTADO",
        modulo: "PEDIDOS",
        descripcion: `Cambió el estado del pedido mensual N° ${pedido.id} de ${anterior} a ${estado} desde Depósito Central`,
      });
    }

    return res.status(200).json(respuesta);
  } catch (error) {
    if (transaction) await transaction.rollback();
    return res.status(error.status || 500).json({
      mensaje: error.status ? error.message : "Error al actualizar estado del pedido",
    });
  }
};

module.exports = {
  obtenerContexto,
  listarActivosDeposito,
  crearActivoDeposito,
  actualizarActivoDeposito,
  transferirActivoDeposito,
  listarInsumosDeposito,
  crearInsumoDeposito,
  listarMovimientosDeposito,
  registrarMovimientoDeposito,
  asignarStockDeposito,
  listarSolicitudesDeposito,
  responderSolicitudDeposito,
  listarPedidosDeposito,
  proveerPedidoDeposito,
  actualizarEstadoPedidoDeposito,
};
