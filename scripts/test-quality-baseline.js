const assert = require("assert");
const fs = require("fs");

const rootPackage = require("../package.json");
const frontendPackage = require("../inventario-frontend/package.json");
const eslintConfig = fs.readFileSync(
  "inventario-frontend/eslint.config.js",
  "utf8",
);

assert.strictEqual(
  frontendPackage.scripts.lint,
  "eslint . --max-warnings=0",
  "El lint frontend debe fallar ante warnings nuevos",
);

for (const script of ["check:backend", "check:frontend", "check", "test"]) {
  assert.ok(rootPackage.scripts[script], `Falta script ${script}`);
}

assert.match(eslintConfig, /caughtErrors:\s*"none"/);
assert.match(eslintConfig, /src\/pages\/HistorialPedidos\.jsx/);
assert.match(eslintConfig, /src\/pages\/MovimientosStock\.jsx/);
assert.match(eslintConfig, /src\/pages\/ReportePedidos\.jsx/);
assert.match(eslintConfig, /src\/components\/Layout\.jsx/);
assert.match(eslintConfig, /src\/pages\/ConsumoOficina\.jsx/);
assert.match(eslintConfig, /src\/pages\/ReporteConsumoOficina\.jsx/);
assert.match(eslintConfig, /src\/pages\/StockOficina\.jsx/);

console.log("Baseline de calidad validado correctamente.");
