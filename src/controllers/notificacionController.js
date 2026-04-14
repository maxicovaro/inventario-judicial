const { Notificacion } = require('../models');

const listarNotificaciones = async (req, res) => {
  try {
    const notificaciones = await Notificacion.findAll({
      where: { usuario_id: req.usuario.id },
      order: [['id', 'DESC']],
    });

    return res.status(200).json(notificaciones);
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al listar notificaciones',
      error: error.message,
    });
  }
};

const marcarComoLeida = async (req, res) => {
  try {
    const { id } = req.params;

    const notificacion = await Notificacion.findByPk(id);

    if (!notificacion) {
      return res.status(404).json({
        mensaje: 'Notificación no encontrada',
      });
    }

    if (notificacion.usuario_id !== req.usuario.id) {
      return res.status(403).json({
        mensaje: 'No tenés permiso para modificar esta notificación',
      });
    }

    await notificacion.update({ leida: true });

    return res.status(200).json({
      mensaje: 'Notificación marcada como leída',
      notificacion,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al marcar notificación como leída',
      error: error.message,
    });
  }
};

const contarNoLeidas = async (req, res) => {
  try {
    const total = await Notificacion.count({
      where: {
        usuario_id: req.usuario.id,
        leida: false,
      },
    });

    return res.status(200).json({ total });
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al contar notificaciones',
      error: error.message,
    });
  }
};

module.exports = {
  listarNotificaciones,
  marcarComoLeida,
  contarNoLeidas,
};