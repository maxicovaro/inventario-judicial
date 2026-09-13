const assert = require("assert");
const fs = require("fs");

const router = fs.readFileSync("inventario-frontend/src/router/AppRouter.jsx", "utf8");
const app = fs.readFileSync("inventario-frontend/src/App.jsx", "utf8");
const frontendBaseline = fs.readFileSync("scripts/performance-frontend.js", "utf8");
const budgets = JSON.parse(fs.readFileSync("performance/budgets.json", "utf8"));

assert.match(router, /import \{ lazy, Suspense \} from "react"/);
assert.match(router, /import Login from "\.\.\/pages\/Login"/);
assert.match(router, /<Suspense fallback=\{<RouteFallback \/>\}>/);
assert.match(router, /role="status"/);
assert.match(router, /aria-live="polite"/);

for (const page of [
  "Dashboard",
  "Activos",
  "Insumos",
  "Solicitudes",
  "MovimientosStock",
  "Notificaciones",
  "Adjuntos",
  "PedidoMensual",
  "HistorialPedidos",
  "ReportePedidos",
  "Usuarios",
  "Bitacora",
  "StockOficina",
  "ConsumoOficina",
  "ReporteConsumoOficina",
]) {
  assert.match(
    router,
    new RegExp(`const ${page} = lazy\\(\\(\\) => import\\("\\.\\.\\/pages\\/${page}"\\)\\)`),
    `${page} debe mantenerse como ruta lazy`,
  );
  assert.doesNotMatch(
    router,
    new RegExp(`import ${page} from`),
    `${page} no debe volver al bundle inicial mediante import estático`,
  );
}

assert.match(app, /@fontsource\/inter\/latin-400\.css/);
assert.doesNotMatch(app, /import "@fontsource\/inter";/);

assert.match(frontendBaseline, /initial_js_gzip_kb/);
assert.match(frontendBaseline, /initial_assets/);
assert.match(frontendBaseline, /font_gzip_kb/);
assert.match(frontendBaseline, /modulepreload/);
assert.ok(
  budgets.frontend.hard_initial_js_gzip_kb > budgets.frontend.target_initial_js_gzip_kb,
  "El techo duro de JS inicial debe superar al objetivo",
);
assert.ok(
  budgets.frontend.hard_font_gzip_kb > budgets.frontend.target_font_gzip_kb,
  "El techo duro de fuentes debe superar al objetivo",
);

console.log("Contratos de rendimiento frontend P8.4 validados correctamente.");
