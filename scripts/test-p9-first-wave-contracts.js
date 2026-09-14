const fs = require("fs");
const path = require("path");
const { validateManifest } = require("./pilot-onboarding-utils");

const root = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const example = JSON.parse(read("pilot/wave.example.json"));
const validation = validateManifest(example);
assert(validation.valid, validation.errors.join("; "));
assert(example.wave_id === "p9-2b-wave-1", "El ejemplo debe representar P9.2B wave 1");
assert(example.approved === false, "El ejemplo versionado nunca debe quedar aprobado");
assert(
  example.offices.length === 2 &&
    example.offices.includes("Área Contable") &&
    example.offices.includes("Área Informática"),
  "P9.2B debe limitar la primera ola a Contable + Informática",
);
assert(
  example.users.filter(
    (user) => user.office === "Área Contable" && user.role === "RESPONSABLE",
  ).length >= 2,
  "La primera ola debe ejercitar operación multiusuario con dos responsables de Contable",
);
assert(
  example.users.some(
    (user) => user.office === "Área Informática" && user.role === "RESPONSABLE",
  ),
  "La primera ola necesita un responsable de Informática",
);
assert(
  example.users.some(
    (user) => user.office === "Área Informática" && user.role === "USUARIO",
  ),
  "La primera ola necesita un usuario común de Informática para probar scope",
);
assert(
  example.users.every((user) => user.email.endsWith(".invalid")),
  "El ejemplo P9.2B no debe contener emails reales",
);

const checker = read("scripts/pilot-onboarding-check.js");
for (const required of [
  "20260913_006_deposito_central_capabilities.js",
  "gestiona_deposito",
  "es_deposito_central",
  "P9.2B exige al menos dos RESPONSABLE de Área Contable",
  "P9.2B exige al menos un RESPONSABLE de Área Informática",
  "P9.2B exige al menos un USUARIO de Área Informática",
  "DEPLOY_REVISION",
  "Prerrequisitos P9.2A verificados",
]) {
  assert(checker.includes(required), `Falta contrato P9.2B en checker: ${required}`);
}

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
  assert(!checker.includes(forbidden), `El plan P9.2B dejó de ser read-only: ${forbidden}`);
}

const authProvider = read("inventario-frontend/src/auth/AuthProvider.jsx");
assert(
  authProvider.includes('aplicarRespuestaAuth(response.data, { autenticar: false })'),
  "El login P9.2B debe evitar marcar authenticated antes de refrescar el perfil canónico",
);
assert(
  authProvider.includes('setEstado("loading");\n        return refrescarSesion({ mostrarCarga: false });'),
  "El login P9.2B debe esperar /auth/me antes de habilitar navegación con capacidades de oficina",
);

const docs = read("docs/P9_2B_FIRST_WAVE.md");
for (const required of [
  "Área Contable",
  "Área Informática",
  "dos `RESPONSABLE`",
  "migración 006",
  "backup",
  "plan",
  "Gestión de Usuarios",
  "verify",
  "rollback",
  "no se versionan",
]) {
  assert(docs.includes(required), `Falta en runbook P9.2B: ${required}`);
}

const gitignore = read(".gitignore");
assert(
  gitignore.includes("pilot/*.private.json"),
  "Los manifiestos reales de P9.2B deben permanecer fuera de Git",
);

console.log("✓ P9.2B first-wave contracts validados.");
