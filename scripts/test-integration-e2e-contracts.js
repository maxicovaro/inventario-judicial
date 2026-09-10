const assert = require("assert");
const fs = require("fs");
const path = require("path");

const read = (relativePath) =>
  fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");

const fixtures = read("scripts/integration-fixtures.js");
const integrationCore = read("scripts/test-integration-flows.js");
const integrationAttachments = read(
  "scripts/test-integration-attachments-requests.js",
);
const integration = `${integrationCore}\n${integrationAttachments}`;
const e2eConfig = read("e2e/playwright.config.cjs");
const e2eSpec = read("e2e/critical-flows.spec.cjs");
const workflow = read(".github/workflows/quality.yml");
const packageJson = read("package.json");

assert.match(fixtures, /NODE_ENV/);
assert.match(fixtures, /NODE_ENV=test/);
assert.match(fixtures, /DB_NAME/);
assert.match(fixtures, /test\|ci\|e2e/);
assert.match(fixtures, /FOREIGN_KEY_CHECKS/);

for (const endpoint of [
  "/api/auth/login",
  "/api/usuarios",
  "/api/activos",
  "/api/movimientos",
  "/api/insumos",
  "/api/stock-oficina",
  "/api/pedidos",
  "/api/solicitudes",
  "/api/adjuntos",
]) {
  assert.ok(integration.includes(endpoint), `P4 debe cubrir ${endpoint}`);
}

for (const expectedStatus of ["401", "403", "409"]) {
  assert.ok(
    integration.includes(expectedStatus),
    `P4 debe contener casos negativos HTTP ${expectedStatus}`,
  );
}

assert.match(
  packageJson,
  /"test:integration":\s*"node scripts\/test-integration-flows\.js && node scripts\/test-integration-attachments-requests\.js"/,
);

assert.match(e2eConfig, /workers:\s*1/);
assert.match(e2eConfig, /trace:\s*"retain-on-failure"/);
assert.match(e2eSpec, /E2E_TEST_PASSWORD/);
assert.match(e2eSpec, /resetIntegrationData/);
assert.match(e2eSpec, /test\.beforeEach/);
assert.match(e2eSpec, /RESPONSABLE crea un activo propio/);
assert.match(e2eSpec, /USUARIO consulta activos/);
assert.match(e2eSpec, /Admin General accede a gestión global/);
assert.match(e2eSpec, /solicitud de oficina es revisada por Dirección/);
assert.match(e2eSpec, /pedido mensual se aprueba, provisiona y llega al reporte/);
assert.match(e2eSpec, /adjunto se sube, lista y descarga desde navegador/);
assert.doesNotMatch(e2eSpec, /Inventario#Test2026A/);
assert.doesNotMatch(e2eSpec, /getByDisplayValue/);

assert.match(workflow, /npm run test:integration/);
assert.match(workflow, /npm run test:integration:fixtures/);
assert.match(workflow, /@playwright\/test@1\.63\.0/);
assert.match(workflow, /npm --prefix \.e2e-runtime audit --audit-level=moderate/);
assert.match(workflow, /playwright install/);
assert.match(workflow, /critical-flows|playwright\.config/);

console.log("Contratos de integración MySQL y E2E validados correctamente.");
