const { Op } = require("sequelize");
const { Bitacora, Usuario, Oficina } = require("../models");

const ACCIONES_DEPOSITO = [
  "ALTA_DEPOSITO",
  "EDITAR_DEPOSITO",
  "ENTREGAR_ACTIVO",
  "MOVIMIENTO_DEPOSITO",
  "ASIGNAR_STOCK",
  "RESPONDER_SOLICITUD",
  "PROVEER",
];

const listarAuditoriaDeposito = async (req, res) => {
  try {
    const registros = await Bitacora.findAll({
      where: {
        [Op.or]: [
          { accion: { [Op.in]: ACCIONES_DEPOSITO } },
          { accion: "CREAR", modulo: "INSUMOS" },
          { accion: "CAMBIAR_ESTADO", modulo: "PEDIDOS" },
        ],
      },
      include: [
        {
          model: Usuario,
          attributes: ["id", "nombre", "apellido", "email", "oficina_id"],
          include: [
            {
              model: Oficina,
              attributes: ["id", "nombre"],
            },
          ],
        },
      ],
      order: [
        ["fecha", "DESC"],
        ["id", "DESC"],
      ],
      limit: 1000,
    });

    return res.status(200).json(registros);
  } catch (error) {
    console.error("ERROR listarAuditoriaDeposito:", error);
    return res.status(500).json({
      mensaje: "Error al consultar la auditoría operativa del Depósito Central",
    });
  }
};

module.exports = {
  listarAuditoriaDeposito,
};
