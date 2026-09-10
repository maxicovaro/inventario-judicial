const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { esAdminGeneral } = require("../src/utils/permisos");

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

assert.strictEqual(esAdminGeneral(adminCentral), true);
assert.strictEqual(esAdminGeneral(adminNoCentral), false);

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
const migration = fs.readFileSync(
  "src/db/migrations/20260909_002_oficina_central.js",
  "utf8",
);

assert.match(oficinaModel, /es_central/);
assert.match(migration, /describeTable\("oficinas"\)/);
assert.match(migration, /addColumn\("oficinas", "es_central"/);
assert.match(permisos, /oficina_es_central/);
assert.doesNotMatch(permisos, /includes\("DIRECCION"\)/);
assert.doesNotMatch(permisos, /includes\("POLICIA JUDICIAL"\)/);
assert.match(authMiddleware, /verificarAdminGeneral/);
assert.match(authMiddleware, /oficina_es_central/);
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
assert.match(layout, /esAdminGeneral/);

const globalAdminRoutes = [
  "usuarioRoutes.js",
  "roleRoutes.js",
  "bitacoraRoutes.js",
  "insumoRoutes.js",
  "movimientoStockRoutes.js",
  "stockOficinaRoutes.js",
  "pedidoInsumoRoutes.js",
  "reportePedidoRoutes.js",
];

for (const file of globalAdminRoutes) {
  const contenido = fs.readFileSync(path.join("src/routes", file), "utf8");
  assert.match(contenido, /verificarAdminGeneral/);
  assert.doesNotMatch(contenido, /verificarRol\(\s*["']ADMIN["']\s*\)/);
}

console.log("Administrador General y rutas globales validados correctamente.");
