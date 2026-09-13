const assert = require("assert");
const fs = require("fs");

const packageJson = require("../package.json");
const profiler = fs.readFileSync("scripts/performance-stock-contention.js", "utf8");
const classifier = fs.readFileSync(
  "scripts/performance-stock-contention-classify.js",
  "utf8",
);
const stockController = fs.readFileSync("src/controllers/stockOficinaController.js", "utf8");
const consumoController = fs.readFileSync("src/controllers/consumoOficinaController.js", "utf8");
const workflow = fs.readFileSync(".github/workflows/quality.yml", "utf8");

assert.match(packageJson.scripts["perf:stock-contention"], /performance-stock-contention/);
assert.match(
  packageJson.scripts["perf:stock-contention"],
  /performance-stock-contention-classify/,
);
assert.match(
  packageJson.scripts["test:p8-regression-contracts"],
  /test-p8-regression-contracts/,
);
assert.match(packageJson.scripts.test, /test:p8-regression-contracts/);

assert.match(profiler, /assertSafeIntegrationDatabase\(\)/);
assert.match(profiler, /preparePerformanceDataset\(\)/);
assert.match(profiler, /CONCURRENCY_LEVELS\s*=\s*\[1,\s*20\]/);
assert.match(profiler, /sequelize\.options\.benchmark\s*=\s*true/);
assert.match(profiler, /sequelize\.options\.logging/);
assert.match(profiler, /FOR UPDATE/i);
assert.match(profiler, /invariant_ok/);
assert.match(profiler, /stock-contention-profile\.json/);
assert.match(profiler, /production_change_required:\s*false/);

assert.match(classifier, /central_stock_lock_sql_share_pct/);
assert.match(classifier, /central_stock_lock_avg_wait_multiplier/);
assert.match(classifier, /http_p95_multiplier_c20_vs_c1/);
assert.match(classifier, /sqlSharePct\s*>=\s*50/);
assert.match(classifier, /avgWaitMultiplier\s*>=\s*5/);
assert.match(classifier, /production_change_required:\s*false/);
assert.match(
  classifier,
  /preserve_consistency_locks_and_regression_guards/,
);

assert.match(
  stockController,
  /Insumo\.findByPk\([\s\S]*?lock:\s*transaction\.LOCK\.UPDATE/,
  "Asignación debe conservar lock del stock central",
);
assert.match(
  stockController,
  /stockOficina\.reload\([\s\S]*?lock:\s*transaction\.LOCK\.UPDATE/,
  "Asignación debe conservar lock del stock de oficina",
);
assert.match(
  consumoController,
  /StockOficina\.findOne\([\s\S]*?lock:\s*transaction\.LOCK\.UPDATE/,
  "Consumo debe conservar lock del stock de oficina",
);
assert.match(stockController, /iniciarTransaccionIdempotente/);
assert.match(stockController, /completarIdempotencia/);
assert.match(consumoController, /iniciarTransaccionIdempotente/);
assert.match(consumoController, /completarIdempotencia/);

assert.match(workflow, /Run P8\.6 stock contention profile/);
assert.match(workflow, /Upload P8\.6 stock contention artifact/);
assert.match(workflow, /performance-stock-contention/);

console.log("Contratos de optimización/regresión P8.6 validados correctamente.");
