const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const bootstrap = read("scripts/pilot-staging-bootstrap.js");
const seeder = read("src/seeders/initialData.js");
const packageJson = JSON.parse(read("package.json"));

for (const required of [
  "DEPLOY_ENV=staging",
  "NODE_ENV=production",
  "--expected-revision",
  "DEPLOY_REVISION no coincide",
  "20260913_006_deposito_central_capabilities.js",
  "seedInitialData({ transaction })",
  "Usuarios:",
  "sin cambios",
  "Área Contable",
  "Depósito",
  "Área Informática",
  "exactamente una oficina gestora del depósito",
  "exactamente un Depósito Central",
]) {
  assert(bootstrap.includes(required), `Falta guarda de bootstrap P9.2B: ${required}`);
}

for (const forbidden of [
  "Usuario.create(",
  "Usuario.update(",
  "Usuario.destroy(",
  "sequelize.query(\"INSERT",
  "sequelize.query('INSERT",
  "sequelize.query(\"UPDATE",
  "sequelize.query('UPDATE",
  "sequelize.query(\"DELETE",
  "sequelize.query('DELETE",
]) {
  assert(
    !bootstrap.includes(forbidden),
    `El bootstrap P9.2B contiene mutación de usuarios/SQL manual prohibida: ${forbidden}`,
  );
}

assert(
  !/\bUsuario\b/.test(seeder),
  "El seeder de catálogos no debe importar ni manipular Usuario",
);
assert(
  seeder.includes("seedInitialData = async ({ transaction } = {})"),
  "El seed base debe aceptar una transacción opcional",
);
assert(
  seeder.includes("transaction,"),
  "El seed base debe propagar la transacción a findOrCreate",
);
assert(
  seeder.includes("registro.update(cambios, { transaction })"),
  "Las correcciones de capacidades deben ejecutarse dentro de la transacción",
);

assert(
  packageJson.scripts?.["pilot:staging:bootstrap"] ===
    "node scripts/pilot-staging-bootstrap.js",
  "Falta script pilot:staging:bootstrap",
);
assert(
  packageJson.scripts?.["test:p9-staging-bootstrap-contracts"] ===
    "node scripts/test-p9-staging-bootstrap-contracts.js",
  "Falta test:p9-staging-bootstrap-contracts",
);
assert(
  String(packageJson.scripts?.test || "").includes(
    "test:p9-staging-bootstrap-contracts",
  ),
  "npm test debe ejecutar el contrato del bootstrap de staging",
);

console.log("✓ P9.2B staging bootstrap contracts validados.");
