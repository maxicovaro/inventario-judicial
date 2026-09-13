const fs = require("fs");
const path = require("path");
const {
  validateManifest,
  maskEmail,
} = require("./pilot-onboarding-utils");

const root = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const example = JSON.parse(read("pilot/wave.example.json"));
const exampleValidation = validateManifest(example);
assert(exampleValidation.valid, exampleValidation.errors.join("; "));
assert(example.approved === false, "El manifiesto versionado debe ser solo ejemplo no aprobado");
assert(
  example.users.every((user) => user.email.endsWith(".invalid")),
  "El ejemplo no debe contener emails reales",
);

const invalidAdminManifest = {
  ...example,
  users: [
    {
      nombre: "Admin",
      apellido: "No permitido",
      email: "admin@example.invalid",
      role: "ADMIN",
      office: example.offices[0],
    },
  ],
};
assert(
  !validateManifest(invalidAdminManifest).valid,
  "P9.2 no debe permitir crear ADMIN desde el manifiesto de ola",
);

assert(
  maskEmail("persona@ejemplo.local") !== "persona@ejemplo.local",
  "La salida del checker debe poder enmascarar emails",
);

const checker = read("scripts/pilot-onboarding-check.js");
for (const forbidden of [
  "Usuario.create(",
  "Usuario.update(",
  ".destroy(",
  "sequelize.query(\"INSERT",
  "sequelize.query('INSERT",
  "sequelize.query(\"UPDATE",
  "sequelize.query('UPDATE",
  "sequelize.query(\"DELETE",
  "sequelize.query('DELETE",
]) {
  assert(!checker.includes(forbidden), `El checker read-only contiene operación prohibida: ${forbidden}`);
}

for (const required of [
  "LISTO_PARA_ALTA_MANUAL",
  "VERIFICADO",
  "Todos los ADMIN activos deben tener MFA habilitado antes del piloto",
  "No se modificó la base de datos",
  "approved=true",
]) {
  assert(checker.includes(required), `Falta contrato de onboarding: ${required}`);
}

const gitignore = read(".gitignore");
assert(
  gitignore.includes("pilot/*.private.json") && gitignore.includes("pilot/*.local.json"),
  "Los manifiestos privados/locales del piloto deben quedar fuera de Git",
);

const docs = read("docs/P9_2_CONTROLLED_ONBOARDING.md");
for (const required of [
  "alta real se realiza únicamente desde el módulo administrativo",
  "primera ola",
  "rollback operativo",
  "MFA",
  "bitácora",
  "No incluir contraseñas",
]) {
  assert(docs.includes(required), `Falta en documentación P9.2: ${required}`);
}

const packageJson = JSON.parse(read("package.json"));
assert(
  packageJson.scripts?.["pilot:onboarding:check"] ===
    "node scripts/pilot-onboarding-check.js",
  "Falta script pilot:onboarding:check",
);
assert(
  packageJson.scripts?.["test:p9-onboarding-contracts"] ===
    "node scripts/test-p9-onboarding-contracts.js",
  "Falta test:p9-onboarding-contracts",
);
assert(
  String(packageJson.scripts?.test || "").includes("test:p9-onboarding-contracts"),
  "npm test debe ejecutar contratos P9.2",
);

console.log("✓ P9.2 controlled onboarding contracts validados.");
