const {
  PedidoInsumo,
  PedidoInsumoDetalle,
  Insumo,
  Usuario,
  Oficina,
} = require("../models");

const crearPedido = async (req, res) => {
  try {
    const {
      mes,
      anio,
      cantidad_hechos_delictivos,
      cantidad_autopsias,
      observaciones,
      detalles,
    } = req.body;

    if (!mes || !anio || !Array.isArray(detalles) || detalles.length === 0) {
      return res.status(400).json({
        mensaje: "Mes, año y detalles son obligatorios",
      });
    }

    const usuario = await Usuario.findByPk(req.usuario.id);

    if (!usuario) {
      return res.status(404).json({
        mensaje: "Usuario no encontrado",
      });
    }

    if (!usuario.oficina_id) {
      return res.status(400).json({
        mensaje: "El usuario no tiene una oficina asignada",
      });
    }

    const oficina = await Oficina.findByPk(usuario.oficina_id);

    if (!oficina) {
      return res.status(404).json({
        mensaje: "La oficina del usuario no existe",
      });
    }

    const existente = await PedidoInsumo.findOne({
      where: {
        oficina_id: usuario.oficina_id,
        mes,
        anio,
      },
    });

    if (existente) {
      return res.status(400).json({
        mensaje: "Ya existe un pedido para ese mes y esa oficina",
      });
    }

    const pedido = await PedidoInsumo.create({
      usuario_id: req.usuario.id,
      oficina_id: usuario.oficina_id,
      mes,
      anio,
      cantidad_hechos_delictivos: cantidad_hechos_delictivos || 0,
      cantidad_autopsias: cantidad_autopsias || 0,
      observaciones: observaciones || null,
      estado: "ENVIADO",
    });

    for (const item of detalles) {
      if (item.insumo_id) {
        const insumo = await Insumo.findByPk(item.insumo_id);
        if (!insumo) {
          return res.status(404).json({
            mensaje: `El insumo con ID ${item.insumo_id} no existe`,
          });
        }
      }

      await PedidoInsumoDetalle.create({
        pedido_id: pedido.id,
        insumo_id: item.insumo_id || null,
        articulo_manual: item.articulo_manual || null,
        cantidad_solicitada: item.cantidad_solicitada || 0,
        tuvo_problema: item.tuvo_problema || false,
        detalle_problema: item.detalle_problema || null,
        cantidad_provista: item.cantidad_provista || 0,
      });
    }

    return res.status(201).json({
      mensaje: "Pedido creado correctamente",
      pedido,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al crear pedido",
      error: error.message,
    });
  }
};

const listarPedidos = async (req, res) => {
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
    return res.status(500).json({
      mensaje: "Error al listar pedidos",
      error: error.message,
    });
  }
};

module.exports = {
  crearPedido,
  listarPedidos,
};