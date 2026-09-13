const assert = require("assert");
const fs = require("fs");

const read = (path) => fs.readFileSync(path, "utf8");

const solicitudes = read("inventario-frontend/src/pages/Solicitudes.jsx");
const adjuntosPage = read("inventario-frontend/src/pages/Adjuntos.jsx");
const catalogo = read("src/controllers/activoCatalogoController.js");
const adjuntosController = read("src/controllers/adjuntoController.js");
const uploadMiddleware = read("src/middlewares/uploadMiddleware.js");
const reportePedido = read("src/controllers/reportePedidoController.js");
const reportePedidoData = read("src/services/reportePedidoData.js");
const reporteConsumo = read("src/controllers/reporteConsumoOficinaController.js");

assert.doesNotMatch(solicitudes, /api\.get\(["']\/activos["']\)/);
assert.match(solicitudes, /\/activos\/catalogo/);
assert.doesNotMatch(adjuntosPage, /api\.get\(["']\/activos["']\)/);
assert.match(adjuntosPage, /\/activos\/catalogo/);
assert.match(adjuntosPage, /limit:\s*50/);

assert.match(catalogo, /MAX_LIMIT\s*=\s*500/);
assert.match(catalogo, /attributes:\s*\["id",\s*"nombre",\s*"codigo_interno",\s*"oficina_id"\]/);
assert.match(catalogo, /where\.oficina_id\s*=\s*oficinaId/);
assert.match(catalogo, /numero_serie/);

assert.match(adjuntosController, /attributes:\s*\{\s*exclude:\s*\["ruta_archivo"\]/);
assert.match(adjuntosController, /delete adjuntoPublico\.ruta_archivo/);
assert.match(adjuntosController, /res\.download\(filePath, adjunto\.nombre_archivo\)/);

assert.match(uploadMiddleware, /fileSize:\s*10\s*\*\s*1024\s*\*\s*1024/);
assert.match(uploadMiddleware, /application\/pdf/);
assert.match(adjuntosController, /resize\(\{ width:\s*1600, withoutEnlargement:\s*true \}\)/);
assert.match(adjuntosController, /jpeg\(\{ quality:\s*75 \}\)/);

assert.match(reportePedido, /obtenerDatosResumenPedidos/);
assert.match(reportePedido, /doc\.pipe\(res\)/);
assert.match(reportePedidoData, /Promise\.all/);
assert.match(reporteConsumo, /Promise\.all/);
assert.match(reporteConsumo, /INSUMO_REPORT_ATTRIBUTES/);

console.log("Contratos P8.3 de payloads, uploads y reportes validados correctamente.");
