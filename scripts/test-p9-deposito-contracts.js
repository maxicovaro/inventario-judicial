const assert = require("assert");
const fs = require("fs");

const read = (path) => fs.readFileSync(path, "utf8");

const oficinaModel = read("src/models/Oficina.js");
const migration = read(
  "src/db/migrations/20260913_006_deposito_central_capabilities.js",
);
const permisos = read("src/utils/permisos.js");
const authMiddleware = read("src/middlewares/authMiddleware.js");
const depositoRoutes = read("src/routes/depositoRoutes.js");
const depositoController = read("src/controllers/depositoController.js");
const depositoAuditoriaController = read(
  "src/controllers/depositoAuditoriaController.js",
);
const app = read("src/app.js");
const fixtures = read("scripts/integration-fixtures.js");
const integration = read("scripts/test-p9-deposito-integration.js");
const frontendPermisos = read("inventario-frontend/src/utils/permisos.js");
const privateRoute = read("inventario-frontend/src/components/PrivateRoute.jsx");
const router = read("inventario-frontend/src/router/AppRouter.jsx");
const layout = read("inventario-frontend/src/components/Layout.jsx");

assert.match(oficinaModel, /gestiona_deposito/);
assert.match(oficinaModel, /es_deposito_central/);
assert.match(
  migration,
  /addColumnIfMissing\(queryInterface, "oficinas", "gestiona_deposito"/,
);
assert.match(
  migration,
  /addColumnIfMissing\(queryInterface, "oficinas", "es_deposito_central"/,
);

assert.match(permisos, /oficina_gestiona_deposito/);
assert.match(permisos, /puedeGestionarDeposito/);
assert.doesNotMatch(
  permisos,
  /Área Contable|Area Contable|CONTAB(?:LE|ILIDAD)/i,
  "La autorización de depósito no puede depender del nombre visible de Contable",
);
assert.doesNotMatch(
  frontendPermisos,
  /Área Contable|Area Contable|CONTAB(?:LE|ILIDAD)/i,
  "El frontend tampoco puede decidir permisos por nombre de oficina",
);

assert.match(authMiddleware, /verificarGestionDeposito/);
assert.match(authMiddleware, /oficina_gestiona_deposito/);
assert.match(authMiddleware, /gestiona_deposito/);
assert.match(depositoRoutes, /router\.use\(verificarToken, verificarGestionDeposito\)/);
assert.match(depositoRoutes, /router\.get\("\/auditoria", listarAuditoriaDeposito\)/);
assert.match(depositoRoutes, /exigirStockInicialCero/);
assert.match(depositoRoutes, /Los insumos nuevos se crean con stock 0/);
assert.match(app, /app\.use\("\/api\/deposito", depositoRoutes\)/);

assert.match(depositoController, /where:\s*\{ es_deposito_central: true \}/);
assert.match(depositoController, /deposito:activo:create/);
assert.match(depositoController, /deposito:activo:transferir/);
assert.match(depositoController, /deposito:insumo:movimiento/);
assert.match(depositoController, /asignarStockAOficina/);
assert.match(depositoController, /actualizarProvision/);
assert.doesNotMatch(
  depositoController,
  /Usuario\.(?:create|update|destroy)/,
  "El módulo de depósito no debe administrar usuarios",
);

assert.match(depositoAuditoriaController, /Bitacora\.findAll/);
assert.match(depositoAuditoriaController, /model: Usuario/);
assert.match(depositoAuditoriaController, /ENTREGAR_ACTIVO/);
assert.match(depositoAuditoriaController, /ASIGNAR_STOCK/);
assert.match(depositoAuditoriaController, /RESPONDER_SOLICITUD/);
assert.match(depositoAuditoriaController, /PROVEER/);

for (const path of [
  "inventario-frontend/src/pages/DepositoActivos.jsx",
  "inventario-frontend/src/pages/DepositoInsumos.jsx",
  "inventario-frontend/src/pages/DepositoSolicitudes.jsx",
  "inventario-frontend/src/pages/DepositoPedidos.jsx",
  "inventario-frontend/src/pages/DepositoAuditoria.jsx",
]) {
  assert.ok(fs.existsSync(path), `Falta la pantalla ${path}`);
}

assert.match(frontendPermisos, /puedeGestionarDeposito/);
assert.match(privateRoute, /requiereGestionDeposito/);
assert.match(privateRoute, /puedeGestionarDeposito/);
assert.match(router, /\/deposito-central\/activos/);
assert.match(router, /\/deposito-central\/insumos/);
assert.match(router, /\/deposito-central\/solicitudes/);
assert.match(router, /\/deposito-central\/pedidos/);
assert.match(router, /\/deposito-central\/auditoria/);
assert.match(router, /<PrivateRoute requiereGestionDeposito>/);
assert.match(layout, /titulo: "Depósito Central"/);
assert.match(layout, /puedeGestionarDeposito/);
assert.match(layout, /titulo: "Mi oficina"/);
assert.match(layout, /Auditoría operativa/);

assert.match(fixtures, /responsableContable2/);
assert.match(fixtures, /usuarioContable/);
assert.match(integration, /segundo RESPONSABLE de Contable/);
assert.match(integration, /usuario común de Contable no administra Depósito Central/);
assert.match(integration, /recepción y entrega patrimonial pueden ser realizadas por empleados distintos/);
assert.match(integration, /recepción y entrega de stock por responsables diferentes conservan autor individual/);
assert.match(integration, /usuario_id/);

console.log(
  "P9.2A - contratos multiusuario, trazabilidad y Depósito Central validados correctamente.",
);
