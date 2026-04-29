const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Usuario, Role, Oficina } = require("../models");
const { registrarBitacora } = require("../utils/bitacora");

const MAX_INTENTOS = 3;
const BLOQUEO_MINUTOS = 15;

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        mensaje: "Email y contraseña son obligatorios",
      });
    }

    const usuario = await Usuario.findOne({
      where: { email },
      include: [
        { model: Role, attributes: ["id", "nombre"] },
        { model: Oficina, attributes: ["id", "nombre"] },
      ],
    });

    if (!usuario) {
      return res.status(401).json({
        mensaje: "Credenciales inválidas",
      });
    }

    if (
      usuario.bloqueado_hasta &&
      new Date(usuario.bloqueado_hasta) > new Date()
    ) {
      await registrarBitacora({
        usuario_id: usuario.id,
        accion: "LOGIN_BLOQUEADO",
        modulo: "AUTH",
        descripcion: `Intento de login bloqueado (${usuario.email})`,
      });

      return res.status(403).json({
        mensaje: `Usuario bloqueado hasta ${new Date(
          usuario.bloqueado_hasta,
        ).toLocaleTimeString("es-AR")}`,
      });
    }

    const passwordValida = await bcrypt.compare(password, usuario.password);

    if (!passwordValida) {
      // 🔥 IMPORTANTE: sumar correctamente
      const nuevosIntentos = (usuario.intentos_fallidos || 0) + 1;

      let bloqueo = null;

      if (nuevosIntentos >= 3) {
        bloqueo = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
      }

      await usuario.update({
        intentos_fallidos: nuevosIntentos,
        bloqueado_hasta: bloqueo,
      });

      return res.status(401).json({
        mensaje:
          nuevosIntentos >= 3
            ? "Usuario bloqueado por múltiples intentos fallidos"
            : `Credenciales inválidas (${nuevosIntentos}/3)`,
      });
    }

    if (!usuario.activo) {
      return res.status(403).json({
        mensaje: "El usuario está inactivo",
      });
    }

    await usuario.update({
      intentos_fallidos: 0,
      bloqueado_hasta: null,
    });

    const token = jwt.sign(
      {
        id: usuario.id,
        email: usuario.email,
        role: usuario.Role?.nombre || "",
        oficina_id: usuario.oficina_id,
        oficina_nombre: usuario.Oficina?.nombre || "",
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" },
    );

    await registrarBitacora({
      usuario_id: usuario.id,
      accion: "LOGIN",
      modulo: "AUTH",
      descripcion: `Login exitoso de ${usuario.email}`,
    });

    return res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        role: usuario.Role?.nombre,
        oficina_id: usuario.oficina_id,
        oficina_nombre: usuario.Oficina?.nombre || "",
      },
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error en login",
      error: error.message,
    });
  }
};

const logout = async (req, res) => {
  try {
    await registrarBitacora({
      usuario_id: req.usuario.id,
      accion: "LOGOUT",
      modulo: "AUTH",
      descripcion: `Cierre de sesión del usuario ID ${req.usuario.id}`,
    });

    return res.status(200).json({
      mensaje: "Logout registrado correctamente",
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al registrar logout",
      error: error.message,
    });
  }
};

module.exports = {
  login,
  logout,
};
