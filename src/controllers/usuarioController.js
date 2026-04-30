const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const { Usuario, Role, Oficina } = require("../models");
const { registrarBitacora } = require("../utils/bitacora");
const { esAdminGeneral } = require("../utils/permisos");

const exigirAdminGeneral = (req, res) => {
  if (!esAdminGeneral(req.usuario)) {
    res.status(403).json({
      mensaje:
        "Acceso denegado. Solo Dirección de Policía Judicial puede administrar usuarios.",
    });

    return false;
  }

  return true;
};

const mismoId = (a, b) => Number(a) === Number(b);

const listarUsuarios = async (req, res) => {
  try {
    if (!exigirAdminGeneral(req, res)) return;

    const usuarios = await Usuario.findAll({
      attributes: {
        exclude: ["password"],
      },
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
    if (!exigirAdminGeneral(req, res)) return;

    const { nombre, apellido, email, password, role_id, oficina_id, activo } =
      req.body;

    if (
      !nombre ||
      !apellido ||
      !email ||
      !password ||
      !role_id ||
      !oficina_id
    ) {
      return res.status(400).json({
        mensaje:
          "Nombre, apellido, email, contraseña, rol y oficina son obligatorios",
      });
    }

    if (password.trim().length < 6) {
      return res.status(400).json({
        mensaje: "La contraseña debe tener al menos 6 caracteres",
      });
    }

    const emailNormalizado = email.trim().toLowerCase();

    const existe = await Usuario.findOne({
      where: { email: emailNormalizado },
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

    const passwordHash = await bcrypt.hash(password.trim(), 10);

    const usuario = await Usuario.create({
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      email: emailNormalizado,
      password: passwordHash,
      role_id,
      oficina_id,
      activo: activo !== undefined ? activo : true,
    });

    await registrarBitacora({
      usuario_id: req.usuario.id,
      accion: "CREAR",
      modulo: "USUARIOS",
      descripcion: `Creó el usuario ${usuario.nombre} ${usuario.apellido} (${usuario.email})`,
    });

    const usuarioCreado = await Usuario.findByPk(usuario.id, {
      attributes: {
        exclude: ["password"],
      },
      include: [
        { model: Role, attributes: ["id", "nombre"] },
        { model: Oficina, attributes: ["id", "nombre"] },
      ],
    });

    return res.status(201).json({
      mensaje: "Usuario creado correctamente",
      usuario: usuarioCreado,
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
    if (!exigirAdminGeneral(req, res)) return;

    const { id } = req.params;
    const { nombre, apellido, email, password, role_id, oficina_id, activo } =
      req.body;

    const usuario = await Usuario.findByPk(id);

    if (!usuario) {
      return res.status(404).json({
        mensaje: "Usuario no encontrado",
      });
    }

    if (email && email.trim().toLowerCase() !== usuario.email) {
      const existe = await Usuario.findOne({
        where: {
          email: email.trim().toLowerCase(),
          id: {
            [Op.ne]: usuario.id,
          },
        },
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

    const datosActualizados = {};

    if (nombre !== undefined) datosActualizados.nombre = nombre.trim();
    if (apellido !== undefined) datosActualizados.apellido = apellido.trim();
    if (email !== undefined)
      datosActualizados.email = email.trim().toLowerCase();
    if (role_id !== undefined) datosActualizados.role_id = role_id;
    if (oficina_id !== undefined) datosActualizados.oficina_id = oficina_id;

    if (activo !== undefined) {
      datosActualizados.activo = activo;
    }

    if (password && password.trim() !== "") {
      if (password.trim().length < 6) {
        return res.status(400).json({
          mensaje: "La contraseña debe tener al menos 6 caracteres",
        });
      }

      datosActualizados.password = await bcrypt.hash(password.trim(), 10);
    }

    await usuario.update(datosActualizados);

    await registrarBitacora({
      usuario_id: req.usuario.id,
      accion: "EDITAR",
      modulo: "USUARIOS",
      descripcion: `Editó el usuario ${usuario.nombre} ${usuario.apellido} (${usuario.email})`,
    });

    const usuarioActualizado = await Usuario.findByPk(usuario.id, {
      attributes: {
        exclude: ["password"],
      },
      include: [
        { model: Role, attributes: ["id", "nombre"] },
        { model: Oficina, attributes: ["id", "nombre"] },
      ],
    });

    return res.status(200).json({
      mensaje: "Usuario actualizado correctamente",
      usuario: usuarioActualizado,
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
    if (!exigirAdminGeneral(req, res)) return;

    const { id } = req.params;

    const usuario = await Usuario.findByPk(id);

    if (!usuario) {
      return res.status(404).json({
        mensaje: "Usuario no encontrado",
      });
    }

    if (mismoId(usuario.id, req.usuario.id)) {
      return res.status(400).json({
        mensaje: "No podés activar o desactivar tu propio usuario desde esta acción",
      });
    }

    const nuevoEstado = !usuario.activo;

    await usuario.update({
      activo: nuevoEstado,
    });

    await registrarBitacora({
      usuario_id: req.usuario.id,
      accion: nuevoEstado ? "ACTIVAR" : "DESACTIVAR",
      modulo: "USUARIOS",
      descripcion: `${nuevoEstado ? "Activó" : "Desactivó"} el usuario ${usuario.nombre} ${usuario.apellido} (${usuario.email})`,
    });

    const usuarioActualizado = await Usuario.findByPk(usuario.id, {
      attributes: {
        exclude: ["password"],
      },
      include: [
        { model: Role, attributes: ["id", "nombre"] },
        { model: Oficina, attributes: ["id", "nombre"] },
      ],
    });

    return res.status(200).json({
      mensaje: `Usuario ${
        nuevoEstado ? "activado" : "desactivado"
      } correctamente`,
      usuario: usuarioActualizado,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al cambiar estado del usuario",
      error: error.message,
    });
  }
};

const desbloquearUsuario = async (req, res) => {
  try {
    if (!exigirAdminGeneral(req, res)) return;

    const { id } = req.params;

    const usuario = await Usuario.findByPk(id);

    if (!usuario) {
      return res.status(404).json({
        mensaje: "Usuario no encontrado",
      });
    }

    await usuario.update({
      intentos_fallidos: 0,
      bloqueado_hasta: null,
    });

    await registrarBitacora({
      usuario_id: req.usuario.id,
      accion: "DESBLOQUEAR",
      modulo: "USUARIOS",
      descripcion: `Desbloqueó al usuario ${usuario.nombre} ${usuario.apellido} (${usuario.email})`,
    });

    const usuarioActualizado = await Usuario.findByPk(usuario.id, {
      attributes: {
        exclude: ["password"],
      },
      include: [
        { model: Role, attributes: ["id", "nombre"] },
        { model: Oficina, attributes: ["id", "nombre"] },
      ],
    });

    return res.status(200).json({
      mensaje: "Usuario desbloqueado correctamente",
      usuario: usuarioActualizado,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al desbloquear usuario",
      error: error.message,
    });
  }
};

const resetearPasswordUsuario = async (req, res) => {
  try {
    if (!exigirAdminGeneral(req, res)) return;

    const { id } = req.params;
    const { nuevaPassword } = req.body;

    if (!nuevaPassword || nuevaPassword.trim().length < 6) {
      return res.status(400).json({
        mensaje: "La nueva contraseña debe tener al menos 6 caracteres",
      });
    }

    const usuario = await Usuario.findByPk(id);

    if (!usuario) {
      return res.status(404).json({
        mensaje: "Usuario no encontrado",
      });
    }

    const passwordHash = await bcrypt.hash(nuevaPassword.trim(), 10);

    await usuario.update({
      password: passwordHash,
      intentos_fallidos: 0,
      bloqueado_hasta: null,
    });

    await registrarBitacora({
      usuario_id: req.usuario.id,
      accion: "RESETEAR_PASSWORD",
      modulo: "USUARIOS",
      descripcion: `Reseteó la contraseña del usuario ${usuario.nombre} ${usuario.apellido} (${usuario.email})`,
    });

    return res.status(200).json({
      mensaje: "Contraseña reseteada correctamente",
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al resetear contraseña",
      error: error.message,
    });
  }
};

module.exports = {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
  desbloquearUsuario,
  resetearPasswordUsuario,
};