const assert = require("assert");
const fs = require("fs");

const server = fs.readFileSync("server.js", "utf8");
const packageJson = require("../package.json");
const migrator = fs.readFileSync("src/db/migrator.js", "utf8");
const baseline = fs.readFileSync(
  "src/db/migrations/20260909_001_baseline_schema.js",
  "utf8",
);
const stockModel = fs.readFileSync("src/models/StockOficina.js", "utf8");
const pedidoModel = fs.readFileSync("src/models/PedidoInsumo.js", "utf8");

assert.doesNotMatch(server, /sequelize\.sync\s*\(/);
assert.doesNotMatch(server, /seedInitialData/);
assert.match(migrator, /schema_migrations/);
assert.match(migrator, /\.sort\(\)/);
assert.match(migrator, /migration\.up/);
assert.match(baseline, /sequelize\.sync/);
assert.match(baseline, /force:\s*false/);
assert.match(baseline, /alter:\s*false/);
assert.match(stockModel, /uq_stock_oficina_insumo_oficina/);
assert.match(pedidoModel, /uq_pedido_oficina_mes_anio/);

for (const script of ["db:migrate", "db:status", "db:seed", "db:setup"]) {
  assert.ok(packageJson.scripts[script], `Falta script ${script}`);
}

console.log("Ciclo de base de datos y migraciones validado correctamente.");
