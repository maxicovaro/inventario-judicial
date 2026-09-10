const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  esAdminGeneral,
  esResponsable,
  puedeGestionarOficina,
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
  "inventario-frontend/src/pages/Activos.jsx",
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
assert.match(authMiddleware, /verificarGestionOficina/);
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
assert.doesNotMatch(privateRoute, /includes\("DIRECCION"\)/);
assert.doesNotMatch(privateRoute, /includes\("POLICIA JUDICIAL"\)/);
assert.match(layout, /esAdminGeneral/);
assert.doesNotMatch(layout, /includes\("DIRECCION"\)/);
assert.doesNotMatch(layout, /includes\("POLICIA JUDICIAL"\)/);
assert.match(activosFrontend, /puedeGestionarOficina/);
assert.match(activosFrontend, /const puedeGestionar = puedeGestionarOficina\(usuario\)/);

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
