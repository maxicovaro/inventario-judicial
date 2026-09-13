const assert = require("assert");
const fs = require("fs");

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const budgets = JSON.parse(fs.readFileSync("performance/budgets.json", "utf8"));
const workflow = fs.readFileSync(".github/workflows/quality.yml", "utf8");
const docs = fs.readFileSync("docs/PERFORMANCE.md", "utf8");
const fixtures = fs.readFileSync("scripts/performance-fixtures.js", "utf8");
const apiBaseline = fs.readFileSync("scripts/performance-baseline.js", "utf8");
const frontendBaseline = fs.readFileSync("scripts/performance-frontend.js", "utf8");
const backendProfile = fs.readFileSync("scripts/performance-profile.js", "utf8");
const profileUtils = fs.readFileSync("scripts/performance-profile-utils.js", "utf8");
const profileUtilsTest = fs.readFileSync("scripts/test-performance-profile-utils.js", "utf8");

assert.strictEqual(budgets.dataset.activos, 6000);
assert.strictEqual(budgets.dataset.insumos, 300);
assert.ok(budgets.api.activos_admin.hard_p95_ms > budgets.api.activos_admin.target_p95_ms);
assert.ok(
  budgets.api.activos_catalogo_admin.hard_payload_kb >
    budgets.api.activos_catalogo_admin.target_payload_kb,
);
assert.ok(
  budgets.api.activos_catalogo_responsable.hard_payload_kb >
    budgets.api.activos_catalogo_responsable.target_payload_kb,
);
assert.ok(budgets.frontend.hard_total_gzip_kb > budgets.frontend.target_total_gzip_kb);
assert.match(fixtures, /NODE_ENV=test|resetIntegrationData/);
assert.match(fixtures, /PERF_DATASET/);
assert.match(apiBaseline, /p95_ms/);
assert.match(apiBaseline, /budget_status/);
assert.match(apiBaseline, /activos_catalogo_admin/);
assert.match(apiBaseline, /activos_catalogo_responsable/);
assert.match(frontendBaseline, /gzipSync/);
assert.match(backendProfile, /sequelize\.options\.benchmark = true/);
assert.match(backendProfile, /EXPLAIN/);
assert.match(backendProfile, /information_schema\.STATISTICS/);
assert.match(backendProfile, /sql_literals_persisted: false/);
assert.match(profileUtils, /normalizeSql/);
assert.match(profileUtils, /repeated_query_candidates/);
assert.match(profileUtilsTest, /Utilidades de perfilado P8\.1/);
assert.match(packageJson.scripts["perf:fixtures"], /performance-fixtures/);
assert.match(packageJson.scripts["perf:baseline"], /performance-baseline/);
assert.match(packageJson.scripts["perf:profile"], /performance-profile/);
assert.match(packageJson.scripts["perf:frontend"], /performance-frontend/);
assert.match(packageJson.scripts["test:performance-profiler"], /test-performance-profile-utils/);
assert.match(packageJson.scripts.test, /test:performance-profiler/);
assert.match(workflow, /Run P8\.0 API baseline/);
assert.match(workflow, /Run P8\.1 backend\/MySQL profile/);
assert.match(workflow, /Measure P8\.0 frontend baseline/);
assert.match(workflow, /performance-backend-baseline/);
assert.match(workflow, /performance-backend-profile/);
assert.match(workflow, /performance-frontend-baseline/);
assert.match(docs, /6000 activos/);
assert.match(docs, /p50\/p95\/p99/);
assert.match(docs, /techo duro/i);
assert.match(docs, /P8\.1/);

console.log("Contratos de rendimiento P8.0/P8.1/P8.3 validados correctamente.");
