const bcrypt = require('bcryptjs');
const { Usuario, Role, Oficina } = require('../models');

const crearUsuario = async (req, res) => {
  try {
    const {
      nombre,
      apellido,
      email,
      password,
      role_id,
      oficina_id,
    } = req.body;

    if (!nombre || !apellido || !email || !password || !role_id || !oficina_id) {
      return res.status(400).json({
        mensaje: 'Todos los campos obligatorios deben completarse',
      });
    }

    const usuarioExistente = await Usuario.findOne({ where: { email } });
    if (usuarioExistente) {
      return res.status(400).json({
        mensaje: 'Ya existe un usuario con ese email',
      });
    }

    const role = await Role.findByPk(role_id);
    if (!role) {
      return res.status(404).json({
        mensaje: 'El rol indicado no existe',
      });
    }

    const oficina = await Oficina.findByPk(oficina_id);
    if (!oficina) {
      return res.status(404).json({
        mensaje: 'La oficina indicada no existe',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const nuevoUsuario = await Usuario.create({
      nombre,
      apellido,
      email,
      password: hashedPassword,
      role_id,
      oficina_id,
      activo: true,
    });

    return res.status(201).json({
      mensaje: 'Usuario creado correctamente',
      usuario: {
        id: nuevoUsuario.id,
        nombre: nuevoUsuario.nombre,
        apellido: nuevoUsuario.apellido,
        email: nuevoUsuario.email,
        role_id: nuevoUsuario.role_id,
        oficina_id: nuevoUsuario.oficina_id,
        activo: nuevoUsuario.activo,
      },
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al crear el usuario',
      error: error.message,
    });
  }
};

const listarUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.findAll({
      attributes: { exclude: ['password'] },
      include: [
        { model: Role, attributes: ['id', 'nombre'] },
        { model: Oficina, attributes: ['id', 'nombre'] },
      ],
      order: [['id', 'DESC']],
    });

    return res.status(200).json(usuarios);
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al listar usuarios',
      error: error.message,
    });
  }
};

const obtenerUsuarioPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const usuario = await Usuario.findByPk(id, {
      attributes: { exclude: ['password'] },
      include: [
        { model: Role, attributes: ['id', 'nombre'] },
        { model: Oficina, attributes: ['id', 'nombre'] },
      ],
    });

    if (!usuario) {
      return res.status(404).json({
        mensaje: 'Usuario no encontrado',
      });
    }

    return res.status(200).json(usuario);
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al obtener usuario',
      error: error.message,
    });
  }
};

const actualizarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = await Usuario.findByPk(id);

    if (!usuario) {
      return res.status(404).json({
        mensaje: 'Usuario no encontrado',
      });
    }

    const {
      nombre,
      apellido,
      email,
      password,
      role_id,
      oficina_id,
      activo,
    } = req.body;

    if (email && email !== usuario.email) {
      const emailExistente = await Usuario.findOne({ where: { email } });
      if (emailExistente) {
        return res.status(400).json({
          mensaje: 'Ya existe otro usuario con ese email',
        });
      }
    }

    if (role_id) {
      const role = await Role.findByPk(role_id);
      if (!role) {
        return res.status(404).json({
          mensaje: 'El rol indicado no existe',
        });
      }
    }

    if (oficina_id) {
      const oficina = await Oficina.findByPk(oficina_id);
      if (!oficina) {
        return res.status(404).json({
          mensaje: 'La oficina indicada no existe',
        });
      }
    }

    let passwordHasheada = usuario.password;
    if (password) {
      passwordHasheada = await bcrypt.hash(password, 10);
    }

    await usuario.update({
      nombre,
      apellido,
      email,
      password: passwordHasheada,
      role_id,
      oficina_id,
      activo,
    });

    return res.status(200).json({
      mensaje: 'Usuario actualizado correctamente',
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        role_id: usuario.role_id,
        oficina_id: usuario.oficina_id,
        activo: usuario.activo,
      },
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al actualizar usuario',
      error: error.message,
    });
  }
};

const desactivarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = await Usuario.findByPk(id);

    if (!usuario) {
      return res.status(404).json({
        mensaje: 'Usuario no encontrado',
      });
    }

    await usuario.update({ activo: false });

    return res.status(200).json({
      mensaje: 'Usuario desactivado correctamente',
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al desactivar usuario',
      error: error.message,
    });
  }
};

module.exports = {
  crearUsuario,
  listarUsuarios,
  obtenerUsuarioPorId,
  actualizarUsuario,
  desactivarUsuario,
};