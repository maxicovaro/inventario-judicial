require("dotenv").config();

const bcrypt = require("bcryptjs");
const sequelize = require("../src/config/database");
const { Usuario, Role, Oficina } = require("../src/models");
const {
  PASSWORD_BCRYPT_ROUNDS,
  validarPassword,
} = require("../src/utils/passwordPolicy");

const bootstrapAdmin = async () => {
  const email = String(process.env.BOOTSTRAP_ADMIN_EMAIL || "")
    .trim()
    .toLowerCase();
  const passwordInput = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const nombre = String(process.env.BOOTSTRAP_ADMIN_NOMBRE || "Administrador").trim();
  const apellido = String(process.env.BOOTSTRAP_ADMIN_APELLIDO || "General").trim();

  if (!email || !passwordInput) {
    throw new Error(
      "Definí BOOTSTRAP_ADMIN_EMAIL y BOOTSTRAP_ADMIN_PASSWORD antes de ejecutar el bootstrap",
    );
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL no tiene un formato válido");
  }

  const validacionPassword = validarPassword(passwordInput);

  if (!validacionPassword.valida) {
    throw new Error(validacionPassword.mensaje);
  }

  await sequelize.authenticate();

  const adminRole = await Role.findOne({ where: { nombre: "ADMIN" } });
  const oficinaDireccion = await Oficina.findOne({
    where: { nombre: "Dirección de Policía Judicial" },
  });

  if (!adminRole || !oficinaDireccion) {
    throw new Error(
      "Faltan datos base. Iniciá la aplicación una vez para crear roles y oficinas antes del bootstrap",
    );
  }

  const adminExistente = await Usuario.findOne({
    where: { role_id: adminRole.id },
  });

  if (adminExistente) {
    throw new Error(
      "Ya existe un usuario ADMIN. Administrá altas y contraseñas desde el sistema",
    );
  }

  const usuarioConEmail = await Usuario.findOne({ where: { email } });

  if (usuarioConEmail) {
    throw new Error("Ya existe un usuario con BOOTSTRAP_ADMIN_EMAIL");
  }

  const passwordHash = await bcrypt.hash(
    validacionPassword.password,
    PASSWORD_BCRYPT_ROUNDS,
  );

  await Usuario.create({
    nombre,
    apellido,
    email,
    password: passwordHash,
    activo: true,
    role_id: adminRole.id,
    oficina_id: oficinaDireccion.id,
  });

  console.log(`✓ Administrador inicial creado para ${email}`);
};

bootstrapAdmin()
  .catch((error) => {
    console.error("✗ No se pudo crear el administrador inicial:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });