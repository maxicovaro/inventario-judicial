const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  esAdminGeneral,
  esResponsable,
  puedeGestionarOficina,
  puedeGestionarDeposito,
} = require("../src/utils/permisos");

const adminCentral = {
  role: "ADMIN",
  oficina_id: 1,
  oficina_nombre: "Nombre irrelevante",
  oficina_es_central: true,
};
const adminNoCentral = {
  role: "ADMIN",
  oficina_id: 2,
  oficina_nombre: "Dirección de Policía Judicial",
  oficina_es_central: false,
};
const responsable = {
  role: "RESPONSABLE",
  oficina_id: 2,
  oficina_es_central: false,
};
const responsableDeposito = {
  role: "RESPONSABLE",
  oficina_id: 3,
  oficina_es_central: false,
  oficina_gestiona_deposito: true,
};
const responsableSinDeposito = {
  role: "RESPONSABLE",
  oficina_id: 4,
  oficina_es_central: false,
  oficina_gestiona_deposito: false,
};
const usuarioDeposito = {
  role: "USUARIO",
  oficina_id: 3,
  oficina_es_central: false,
  oficina_gestiona_deposito: true,
};
const usuario = {
  role: "USUARIO",
  oficina_id: 2,
  oficina_es_central: false,
};

assert.strictEqual(esAdminGeneral(adminCentral), true);
assert.strictEqual(esAdminGeneral(adminNoCentral), false);
assert.strictEqual(esResponsable(responsable), true);
assert.strictEqual(puedeGestionarOficina(adminCentral), true);
assert.strictEqual(puedeGestionarOficina(responsable), true);
assert.strictEqual(puedeGestionarOficina(usuario), false);
assert.strictEqual(puedeGestionarDeposito(adminCentral), true);
assert.strictEqual(puedeGestionarDeposito(responsableDeposito), true);
assert.strictEqual(puedeGestionarDeposito(responsableSinDeposito), false);
assert.strictEqual(puedeGestionarDeposito(usuarioDeposito), false);

const oficinaModel = fs.readFileSync("src/models/Oficina.js", "utf8");
const permisos = fs.readFileSync("src/utils/permisos.js", "utf8");
const authMiddleware = fs.readFileSync("src/middlewares/authMiddleware.js", "utf8");
const authController = fs.readFileSync("src/controllers/authController.js", "utf8");
const usuarioController = fs.readFileSync("src/controllers/usuarioController.js", "utf8");
const bootstrapAdmin = fs.readFileSync("scripts/bootstrap-admin.js", "utf8");
const privateRoute = fs.readFileSync(
  "inventario-frontend/src/components/PrivateRoute.jsx",
  "utf8",
);
const layout = fs.readFileSync(
  "inventario-frontend/src/components/Layout.jsx",
  "utf8",
);
const activosFrontend = fs.readFileSync(
  "inventario-frontend/src/pages/ActivosPaginados.jsx",
  "utf8",
);
const solicitudesFrontend = fs.readFileSync(
  "inventario-frontend/src/pages/Solicitudes.jsx",
  "utf8",
);
const historialPedidosFrontend = fs.readFileSync(
  "inventario-frontend/src/pages/HistorialPedidos.jsx",
  "utf8",
);
const migration = fs.readFileSync(
  "src/db/migrations/20260909_002_oficina_central.js",
  "utf8",
);
const depositoMigration = fs.readFileSync(
  "src/db/migrations/20260913_006_deposito_central_capabilities.js",
  "utf8",
);

assert.match(oficinaModel, /es_central/);
assert.match(oficinaModel, /gestiona_deposito/);
assert.match(oficinaModel, /es_deposito_central/);
assert.match(migration, /describeTable\("oficinas"\)/);
assert.match(migration, /addColumn\("oficinas", "es_central"/);
assert.match(depositoMigration, /gestiona_deposito/);
assert.match(depositoMigration, /es_deposito_central/);
assert.match(permisos, /oficina_es_central/);
assert.match(permisos, /oficina_gestiona_deposito/);
assert.doesNotMatch(permisos, /includes\("DIRECCION"\)/);
assert.doesNotMatch(permisos, /includes\("POLICIA JUDICIAL"\)/);
assert.doesNotMatch(permisos, /Área Contable|Area Contable/i);
assert.match(authMiddleware, /verificarAdminGeneral/);
assert.match(authMiddleware, /verificarGestionOficina/);
assert.match(authMiddleware, /verificarGestionDeposito/);
assert.match(authMiddleware, /oficina_es_central/);
assert.match(authMiddleware, /oficina_gestiona_deposito/);
assert.match(authController, /oficina_es_central/);

assert.match(bootstrapAdmin, /where:\s*\{ es_central: true \}/);
assert.doesNotMatch(
  bootstrapAdmin,
  /where:\s*\{ nombre: "Dirección de Policía Judicial" \}/,
);

assert.match(usuarioController, /validarAsignacionRolOficina/);
assert.match(
  usuarioController,
  /El rol ADMIN solo puede asignarse a la oficina central/,
);

assert.match(privateRoute, /esAdminGeneral/);
assert.match(privateRoute, /puedeGestionarDeposito/);
assert.match(layout, /esAdminGeneral/);
assert.match(layout, /puedeGestionarDeposito/);
assert.match(activosFrontend, /puedeGestionarOficina/);
assert.match(activosFrontend, /const puedeGestionar = puedeGestionarOficina\(usuario\)/);
assert.match(solicitudesFrontend, /esAdminGeneral/);
assert.match(solicitudesFrontend, /const esDireccion = esAdminGeneral\(usuario\)/);
assert.match(historialPedidosFrontend, /esAdminGeneral/);
assert.match(historialPedidosFrontend, /const esDireccion = esAdminGeneral\(usuario\)/);

const collectFrontendSources = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectFrontendSources(fullPath);
    return /\.(js|jsx)$/.test(entry.name) ? [fullPath] : [];
  });

const frontendRoot = path.resolve("inventario-frontend/src");
const forbiddenFrontendPermission =
  /includes\(\s*["'](?:DIRECCION|POLICIA JUDICIAL)["']\s*\)/;
const frontendConPermisosPorNombre = collectFrontendSources(frontendRoot)
  .filter((file) => forbiddenFrontendPermission.test(fs.readFileSync(file, "utf8")))
  .map((file) => path.relative(process.cwd(), file));

assert.deepStrictEqual(
  frontendConPermisosPorNombre,
  [],
  `Frontend con permisos basados en nombre visible: ${frontendConPermisosPorNombre.join(", ")}`,
);

const routesDir = path.resolve("src/routes");
const routeFiles = fs
  .readdirSync(routesDir)
  .filter((file) => file.endsWith(".js"));

const adminGenerico = /verificarRol\(\s*["']ADMIN["']\s*\)/;
const rutasConAdminGenerico = routeFiles.filter((file) => {
  const contenido = fs.readFileSync(path.join(routesDir, file), "utf8");
  return adminGenerico.test(contenido);
});

assert.deepStrictEqual(
  rutasConAdminGenerico,
  [],
  `Rutas que todavía usan verificarRol(ADMIN) para permisos globales: ${rutasConAdminGenerico.join(", ")}`,
);

console.log("Matriz de autorización y alcance validada correctamente.");
