const bcrypt = require("bcryptjs");
const { Usuario, Role, Oficina } = require("../models");

const listarUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.findAll({
      include: [
        { model: Role, attributes: ["id", "nombre"] },
        { model: Oficina, attributes: ["id", "nombre"] },
      ],
      order: [["id", "DESC"]],
    });

    return res.status(200).json(usuarios);
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al listar usuarios",
      error: error.message,
    });
  }
};

const crearUsuario = async (req, res) => {
  try {
    const { nombre, apellido, email, password, role_id, oficina_id, activo } =
      req.body;

    if (!nombre || !apellido || !email || !password || !role_id || !oficina_id) {
      return res.status(400).json({
        mensaje:
          "Nombre, apellido, email, contraseña, rol y oficina son obligatorios",
      });
    }

    const existe = await Usuario.findOne({
      where: { email },
    });

    if (existe) {
      return res.status(400).json({
        mensaje: "Ya existe un usuario con ese email",
      });
    }

    const role = await Role.findByPk(role_id);
    if (!role) {
      return res.status(404).json({
        mensaje: "Rol no encontrado",
      });
    }

    const oficina = await Oficina.findByPk(oficina_id);
    if (!oficina) {
      return res.status(404).json({
        mensaje: "Oficina no encontrada",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const usuario = await Usuario.create({
      nombre,
      apellido,
      email,
      password: passwordHash,
      role_id,
      oficina_id,
      activo: activo !== undefined ? activo : true,
    });

    return res.status(201).json({
      mensaje: "Usuario creado correctamente",
      usuario,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al crear usuario",
      error: error.message,
    });
  }
};

const actualizarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, apellido, email, password, role_id, oficina_id, activo } =
      req.body;

    const usuario = await Usuario.findByPk(id);

    if (!usuario) {
      return res.status(404).json({
        mensaje: "Usuario no encontrado",
      });
    }

    if (email && email !== usuario.email) {
      const existe = await Usuario.findOne({
        where: { email },
      });

      if (existe) {
        return res.status(400).json({
          mensaje: "Ya existe un usuario con ese email",
        });
      }
    }

    if (role_id) {
      const role = await Role.findByPk(role_id);
      if (!role) {
        return res.status(404).json({
          mensaje: "Rol no encontrado",
        });
      }
    }

    if (oficina_id) {
      const oficina = await Oficina.findByPk(oficina_id);
      if (!oficina) {
        return res.status(404).json({
          mensaje: "Oficina no encontrada",
        });
      }
    }

    const datosActualizados = {
      nombre,
      apellido,
      email,
      role_id,
      oficina_id,
      activo,
    };

    if (password && password.trim() !== "") {
      datosActualizados.password = await bcrypt.hash(password, 10);
    }

    await usuario.update(datosActualizados);

    return res.status(200).json({
      mensaje: "Usuario actualizado correctamente",
      usuario,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al actualizar usuario",
      error: error.message,
    });
  }
};

const cambiarEstadoUsuario = async (req, res) => {
  try {
    const { id } = req.params;

    const usuario = await Usuario.findByPk(id);

    if (!usuario) {
      return res.status(404).json({
        mensaje: "Usuario no encontrado",
      });
    }

    await usuario.update({
      activo: !usuario.activo,
    });

    return res.status(200).json({
      mensaje: `Usuario ${usuario.activo ? "activado" : "desactivado"} correctamente`,
      usuario,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al cambiar estado del usuario",
      error: error.message,
    });
  }
};

module.exports = {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
};