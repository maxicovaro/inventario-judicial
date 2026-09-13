const assert = require("assert");
const fs = require("fs");

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const baseline = fs.readFileSync("scripts/performance-baseline.js", "utf8");
const profile = fs.readFileSync("scripts/performance-profile.js", "utf8");
const activos = fs.readFileSync("inventario-frontend/src/pages/ActivosPaginados.jsx", "utf8");
const controller = fs.readFileSync("src/controllers/activoController.js", "utf8");
const dashboard = fs.readFileSync("src/controllers/dashboardController.js", "utf8");

assert.match(packageJson.scripts["test:p8-query-pagination"], /test-p8-query-pagination/);
assert.match(packageJson.scripts.test, /test:p8-query-pagination/);
assert.match(baseline, /\/api\/activos\?page=1&page_size=25/);
assert.match(profile, /\/api\/activos\?page=1&page_size=25/);
assert.match(controller, /DEFAULT_PAGE_SIZE = 25/);
assert.match(controller, /MAX_PAGE_SIZE = 100/);
assert.match(controller, /obtenerActivo/);
assert.match(controller, /LIST_ATTRIBUTES/);
assert.match(activos, /page_size/);
assert.match(activos, /Filas por página/);
assert.match(activos, /setTimeout/);
assert.match(dashboard, /pedidosPorEstadoRaw/);
assert.doesNotMatch(dashboard, /PedidoInsumo\.count\([\s\S]{0,120}ENVIADO/);

console.log("Contratos estáticos P8.2 validados correctamente.");
