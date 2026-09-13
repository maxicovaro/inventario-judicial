const assert = require("assert");
const fs = require("fs");

const packageJson = require("../package.json");
const budgets = require("../performance/budgets.json");
const loadScript = fs.readFileSync("scripts/performance-load.js", "utf8");
const workflow = fs.readFileSync(".github/workflows/quality.yml", "utf8");

assert.match(packageJson.scripts["perf:load"], /performance-load/);
assert.match(packageJson.scripts["test:p8-load-contracts"], /test-p8-load-contracts/);
assert.match(packageJson.scripts.test, /test:p8-load-contracts/);

for (const name of [
  "auth_me_admin",
  "dashboard_admin",
  "activos_admin",
  "pedidos_responsable",
  "stock_responsable",
  "operational_read_mix",
  "login_success",
  "stock_write_unique",
  "stock_write_idempotent",
]) {
  assert.ok(budgets.load[name], `Falta presupuesto P8.5 para ${name}`);
  assert.ok(
    budgets.load[name].hard_p95_ms >= budgets.load[name].target_p95_ms,
    `Techo p95 inválido para ${name}`,
  );
  assert.strictEqual(budgets.load[name].hard_error_rate_pct, 0);
}

assert.match(loadScript, /assertSafeIntegrationDatabase\(\)/);
assert.match(loadScript, /preparePerformanceDataset\(\)/);
assert.match(loadScript, /P8_LOAD_LEVELS\s*\|\|\s*"1,5,10,20"/);
assert.match(loadScript, /p50_ms/);
assert.match(loadScript, /p95_ms/);
assert.match(loadScript, /p99_ms/);
assert.match(loadScript, /throughput_rps/);
assert.match(loadScript, /error_rate_pct/);
assert.match(loadScript, /first_degradation_concurrency/);
assert.match(loadScript, /Idempotency-Key/);
assert.match(loadScript, /stock_write_unique/);
assert.match(loadScript, /stock_write_idempotent/);
assert.match(loadScript, /invariant_ok/);
assert.match(loadScript, /No constituyen SLA de producción/);

assert.match(workflow, /Run P8\.5 load profile/);
assert.match(workflow, /Upload P8\.5 load profile artifact/);
assert.match(workflow, /performance-load-profile/);

console.log("Contratos de carga P8.5 validados correctamente.");
