const bcrypt = require("bcryptjs");
const sequelize = require("../src/config/database");
const models = require("../src/models");
const seedInitialData = require("../src/seeders/initialData");

const TEST_PASSWORD = "Inventario#Test2026A";

const TEST_USERS = Object.freeze({
  admin: "admin.integration@inventario.test",
  responsable1: "responsable.uj1@inventario.test",
  responsable2: "responsable.uj2@inventario.test",
  usuario1: "usuario.uj1@inventario.test",
});

const assertSafeIntegrationDatabase = () => {
  const environment = String(process.env.NODE_ENV || "").toLowerCase();
  const databaseName = String(process.env.DB_NAME || "").toLowerCase();
  const safeName = /(^|_)(test|ci|e2e)(_|$)/.test(databaseName);

  if (environment !== "test") {
    throw new Error(
      "Los fixtures de integración solo pueden ejecutarse con NODE_ENV=test",
    );
  }

  if (!safeName) {
    throw new Error(
      `Se bloqueó el reset: DB_NAME=${process.env.DB_NAME || "(vacío)"} no parece una base de test/CI`,
    );
  }
};

const quoteTable = (name) => `\`${String(name).replace(/`/g, "``")}\``;

const truncateApplicationTables = async () => {
  const tableNames = [
    ...new Set(
      Object.values(models).map((model) => {
        const table = model.getTableName();
        return typeof table === "string" ? table : table.tableName;
      }),
    ),
  ];

  await sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
  try {
    for (const tableName of tableNames) {
      await sequelize.query(`TRUNCATE TABLE ${quoteTable(tableName)}`);
    }
  } finally {
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
  }
};

const resetIntegrationData = async () => {
  assertSafeIntegrationDatabase();
  await sequelize.authenticate();
  await truncateApplicationTables();
  await seedInitialData();

  const {
    Role,
    Oficina,
    Categoria,
    Usuario,
    Activo,
    Insumo,
  } = models;

  const [adminRole, responsableRole, usuarioRole] = await Promise.all([
    Role.findOne({ where: { nombre: "ADMIN" } }),
    Role.findOne({ where: { nombre: "RESPONSABLE" } }),
    Role.findOne({ where: { nombre: "USUARIO" } }),
  ]);

  const [central, uj1, uj2, categoria] = await Promise.all([
    Oficina.findOne({ where: { es_central: true } }),
    Oficina.findOne({ where: { nombre: "Unidad Judicial N° 1" } }),
    Oficina.findOne({ where: { nombre: "Unidad Judicial N° 2" } }),
    Categoria.findOne({ where: { nombre: "Equipos informáticos y de comunicación" } }),
  ]);

  if (!adminRole || !responsableRole || !usuarioRole) {
    throw new Error("No se encontraron los roles base para integración");
  }
  if (!central || !uj1 || !uj2 || !categoria) {
    throw new Error("No se encontraron oficinas/categoría base para integración");
  }

  const password = await bcrypt.hash(TEST_PASSWORD, 4);

  const createUser = (email, roleId, officeId, nombre) =>
    Usuario.create({
      nombre,
      apellido: "Integración",
      email,
      password,
      role_id: roleId,
      oficina_id: officeId,
      activo: true,
      intentos_fallidos: 0,
      bloqueado_hasta: null,
    });

  const [admin, responsable1, responsable2, usuario1] = await Promise.all([
    createUser(TEST_USERS.admin, adminRole.id, central.id, "Admin"),
    createUser(TEST_USERS.responsable1, responsableRole.id, uj1.id, "Responsable Uno"),
    createUser(TEST_USERS.responsable2, responsableRole.id, uj2.id, "Responsable Dos"),
    createUser(TEST_USERS.usuario1, usuarioRole.id, uj1.id, "Usuario Uno"),
  ]);

  const activoBase = await Activo.create({
    codigo_interno: "E2E-BASE-001",
    nombre: "Equipo base E2E",
    descripcion: "Activo reproducible para pruebas de navegador",
    cantidad: 1,
    estado: "Buen estado",
    categoria_id: categoria.id,
    oficina_id: uj1.id,
    activo: true,
  });

  const insumoBase = await Insumo.create({
    nombre: "Resma A4 Integración",
    categoria: "Librería",
    unidad_medida: "resma",
    stock_actual: 100,
    stock_minimo: 10,
    activo: true,
  });

  return {
    password: TEST_PASSWORD,
    users: {
      admin,
      responsable1,
      responsable2,
      usuario1,
    },
    roles: {
      admin: adminRole,
      responsable: responsableRole,
      usuario: usuarioRole,
    },
    offices: { central, uj1, uj2 },
    categoria,
    activoBase,
    insumoBase,
  };
};

const main = async () => {
  try {
    const fixtures = await resetIntegrationData();
    console.log("✓ Fixtures de integración preparados en base aislada.");
    console.log(`✓ Admin: ${fixtures.users.admin.email}`);
    console.log(`✓ Responsable UJ1: ${fixtures.users.responsable1.email}`);
    console.log(`✓ Usuario UJ1: ${fixtures.users.usuario1.email}`);
  } finally {
    await sequelize.close();
  }
};

if (require.main === module) {
  main().catch((error) => {
    console.error(`✗ Fixtures de integración fallaron: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  TEST_PASSWORD,
  TEST_USERS,
  assertSafeIntegrationDatabase,
  resetIntegrationData,
};
