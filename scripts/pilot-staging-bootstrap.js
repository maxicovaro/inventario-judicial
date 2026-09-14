require("dotenv").config();

const sequelize = require("../src/config/database");
const env = require("../src/config/env");
const { Usuario, Role, Oficina, Categoria } = require("../src/models");
const seedInitialData = require("../src/seeders/initialData");
const { getMigrationStatus } = require("../src/db/migrator");
const { validateDeployment } = require("./deploy-preflight");

const REQUIRED_MIGRATION = "20260913_006_deposito_central_capabilities.js";
const CONTABLE_OFFICE = "Área Contable";
const DEPOSITO_OFFICE = "Depósito";
const INFORMATICA_OFFICE = "Área Informática";
const DIRECCION_OFFICE = "Dirección de Policía Judicial";

const getArg = (name, fallback = null) => {
  const direct = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
};

const validateBootstrapEnvironment = (input, expectedRevision) => {
  const errors = [];
  const preflight = validateDeployment(input);

  if (!preflight.ok) errors.push(...preflight.errors);
  if (String(input.NODE_ENV || "").trim().toLowerCase() !== "production") {
    errors.push("P9.2B bootstrap exige NODE_ENV=production");
  }
  if (String(input.DEPLOY_ENV || "").trim().toLowerCase() !== "staging") {
    errors.push("P9.2B bootstrap solo puede ejecutarse con DEPLOY_ENV=staging");
  }
  if (!expectedRevision || !/^[0-9a-f]{40}$/i.test(expectedRevision)) {
    errors.push("Indicá --expected-revision con un SHA Git de 40 caracteres");
  }
  if (
    expectedRevision &&
    String(input.DEPLOY_REVISION || "").trim() !== expectedRevision
  ) {
    errors.push("DEPLOY_REVISION no coincide con --expected-revision");
  }

  return { ok: errors.length === 0, errors };
};

const assertCatalogs = async ({ transaction } = {}) => {
  const options = transaction ? { transaction, raw: true } : { raw: true };

  const [roles, offices] = await Promise.all([
    Role.findAll({
      where: { nombre: ["ADMIN", "RESPONSABLE", "USUARIO"] },
      attributes: ["nombre"],
      ...options,
    }),
    Oficina.findAll({
      attributes: [
        "id",
        "nombre",
        "es_central",
        "gestiona_deposito",
        "es_deposito_central",
      ],
      ...options,
    }),
  ]);

  const roleNames = new Set(roles.map((role) => role.nombre));
  for (const requiredRole of ["ADMIN", "RESPONSABLE", "USUARIO"]) {
    if (!roleNames.has(requiredRole)) throw new Error(`Falta rol base ${requiredRole}`);
  }

  const byName = new Map(offices.map((office) => [office.nombre, office]));
  const direccion = byName.get(DIRECCION_OFFICE);
  const contable = byName.get(CONTABLE_OFFICE);
  const deposito = byName.get(DEPOSITO_OFFICE);
  const informatica = byName.get(INFORMATICA_OFFICE);

  if (!direccion || !direccion.es_central) {
    throw new Error("Dirección no quedó configurada como oficina central");
  }
  if (!contable || !contable.gestiona_deposito || contable.es_deposito_central) {
    throw new Error("Área Contable no quedó configurada como gestora separada del depósito");
  }
  if (!deposito || !deposito.es_deposito_central || deposito.gestiona_deposito) {
    throw new Error("Depósito no quedó configurado como ubicación central separada");
  }
  if (!informatica || informatica.gestiona_deposito || informatica.es_deposito_central) {
    throw new Error("Área Informática no debe tener capacidades de depósito");
  }

  const gestores = offices.filter((office) => Boolean(office.gestiona_deposito));
  const depositos = offices.filter((office) => Boolean(office.es_deposito_central));
  if (gestores.length !== 1) {
    throw new Error("P9.2B exige exactamente una oficina gestora del depósito");
  }
  if (depositos.length !== 1) {
    throw new Error("P9.2B exige exactamente un Depósito Central");
  }

  return {
    roles: roles.length,
    offices: offices.length,
    managerOffice: contable.nombre,
    centralDeposit: deposito.nombre,
    receivingOffice: informatica.nombre,
  };
};

const main = async () => {
  const expectedRevision = String(getArg("--expected-revision", "")).trim();
  const environmentCheck = validateBootstrapEnvironment(
    process.env,
    expectedRevision,
  );

  if (!environmentCheck.ok) {
    throw new Error(
      `Bootstrap staging rechazado:\n- ${environmentCheck.errors.join("\n- ")}`,
    );
  }

  await sequelize.authenticate();

  const migrationStatus = await getMigrationStatus();
  const migration = migrationStatus.find(
    (item) => item.name === REQUIRED_MIGRATION,
  );
  if (!migration?.applied) {
    throw new Error(`Falta aplicar ${REQUIRED_MIGRATION} antes del bootstrap`);
  }

  const usersBefore = await Usuario.count();
  const officesBefore = await Oficina.count();
  const rolesBefore = await Role.count();
  const categoriesBefore = await Categoria.count();

  let catalogSummary;
  await sequelize.transaction(async (transaction) => {
    const usersInsideBefore = await Usuario.count({ transaction });
    await seedInitialData({ transaction });
    const usersInsideAfter = await Usuario.count({ transaction });

    if (usersInsideAfter !== usersInsideBefore) {
      throw new Error(
        "El seed base intentó alterar la cantidad de usuarios; transacción cancelada",
      );
    }

    catalogSummary = await assertCatalogs({ transaction });
  });

  const usersAfter = await Usuario.count();
  if (usersAfter !== usersBefore) {
    throw new Error("La cantidad de usuarios cambió durante el bootstrap");
  }

  const officesAfter = await Oficina.count();
  const rolesAfter = await Role.count();
  const categoriesAfter = await Categoria.count();
  await assertCatalogs();

  console.log("✓ Bootstrap de catálogos P9.2B completado.");
  console.log(`  Entorno: ${env.DEPLOY_ENV}`);
  console.log(`  Revisión: ${env.DEPLOY_REVISION}`);
  console.log(`  Usuarios: ${usersBefore} -> ${usersAfter} (sin cambios)`);
  console.log(`  Roles: ${rolesBefore} -> ${rolesAfter}`);
  console.log(`  Categorías: ${categoriesBefore} -> ${categoriesAfter}`);
  console.log(`  Oficinas: ${officesBefore} -> ${officesAfter}`);
  console.log(`  Gestora: ${catalogSummary.managerOffice}`);
  console.log(`  Depósito central: ${catalogSummary.centralDeposit}`);
  console.log(`  Receptora piloto: ${catalogSummary.receivingOffice}`);
};

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(`✗ ${error.message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await sequelize.close();
    });
}

module.exports = {
  assertCatalogs,
  validateBootstrapEnvironment,
};
