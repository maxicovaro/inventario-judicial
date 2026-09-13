const assert = require("assert");
const app = require("../src/app");
const sequelize = require("../src/config/database");
const { Activo } = require("../src/models");
const {
  TEST_PASSWORD,
  TEST_USERS,
  resetIntegrationData,
} = require("./integration-fixtures");

const listen = () =>
  new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
    server.once("error", reject);
  });

const close = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeIdleConnections?.();
  });

const readBody = async (response) => {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const request = async (base, path, { method = "GET", token, body } = {}) => {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await readBody(response) };
};

const login = async (base, email) => {
  const result = await request(base, "/api/auth/login", {
    method: "POST",
    body: { email, password: TEST_PASSWORD },
  });
  assert.strictEqual(result.status, 200, `login ${email}`);
  assert.ok(result.body?.token, `login ${email} debe devolver token en test`);
  return result.body.token;
};

const assertCatalogProjection = (item) => {
  const keys = Object.keys(item).sort();
  assert.deepStrictEqual(
    keys,
    ["codigo_interno", "id", "nombre", "oficina_id"],
    `proyección inesperada: ${keys.join(", ")}`,
  );
};

const main = async () => {
  let server;
  try {
    const fixture = await resetIntegrationData();
    await Activo.bulkCreate(
      [
        {
          codigo_interno: "P8-CAT-UJ1-A",
          nombre: "Notebook catálogo UJ1",
          marca: "Marca A",
          modelo: "Modelo A",
          numero_serie: "CAT-UJ1-A",
          cantidad: 1,
          estado: "Buen estado",
          categoria_id: fixture.categoria.id,
          oficina_id: fixture.offices.uj1.id,
          activo: true,
        },
        {
          codigo_interno: "P8-CAT-UJ2-A",
          nombre: "Notebook catálogo UJ2",
          marca: "Marca B",
          modelo: "Modelo B",
          numero_serie: "CAT-UJ2-A",
          cantidad: 1,
          estado: "Buen estado",
          categoria_id: fixture.categoria.id,
          oficina_id: fixture.offices.uj2.id,
          activo: true,
        },
        {
          codigo_interno: "P8-CAT-BAJA",
          nombre: "Activo fuera del catálogo",
          marca: "Marca C",
          modelo: "Modelo C",
          numero_serie: "CAT-BAJA",
          cantidad: 1,
          estado: "Dado de baja",
          categoria_id: fixture.categoria.id,
          oficina_id: fixture.offices.uj1.id,
          activo: false,
        },
      ],
      { validate: true },
    );

    server = await listen();
    const base = `http://127.0.0.1:${server.address().port}`;
    const [adminToken, responsable1Token] = await Promise.all([
      login(base, TEST_USERS.admin),
      login(base, TEST_USERS.responsable1),
    ]);

    const adminSearch = await request(
      base,
      "/api/activos/catalogo?q=P8-CAT&limit=50",
      { token: adminToken },
    );
    assert.strictEqual(adminSearch.status, 200);
    assert.ok(Array.isArray(adminSearch.body.items));
    assert.strictEqual(adminSearch.body.items.length, 2);
    adminSearch.body.items.forEach(assertCatalogProjection);
    assert.ok(
      adminSearch.body.items.every((item) => item.codigo_interno !== "P8-CAT-BAJA"),
    );
    console.log("OK - catálogo proyecta solo campos ligeros y excluye bajas");

    const adminOffice = await request(
      base,
      `/api/activos/catalogo?q=P8-CAT&oficina_id=${fixture.offices.uj2.id}&limit=50`,
      { token: adminToken },
    );
    assert.strictEqual(adminOffice.status, 200);
    assert.strictEqual(adminOffice.body.items.length, 1);
    assert.strictEqual(adminOffice.body.items[0].codigo_interno, "P8-CAT-UJ2-A");
    console.log("OK - Dirección puede acotar catálogo por oficina");

    const responsableScope = await request(
      base,
      `/api/activos/catalogo?q=P8-CAT&oficina_id=${fixture.offices.uj2.id}&limit=50`,
      { token: responsable1Token },
    );
    assert.strictEqual(responsableScope.status, 200);
    assert.ok(responsableScope.body.items.length >= 1);
    assert.ok(
      responsableScope.body.items.every(
        (item) => Number(item.oficina_id) === Number(fixture.offices.uj1.id),
      ),
    );
    assert.ok(
      responsableScope.body.items.some((item) => item.codigo_interno === "P8-CAT-UJ1-A"),
    );
    assert.ok(
      responsableScope.body.items.every((item) => item.codigo_interno !== "P8-CAT-UJ2-A"),
    );
    console.log("OK - oficina solicitada no amplía alcance de RESPONSABLE");

    const bySerial = await request(
      base,
      "/api/activos/catalogo?q=CAT-UJ1-A&limit=10",
      { token: responsable1Token },
    );
    assert.strictEqual(bySerial.status, 200);
    assert.ok(bySerial.body.items.some((item) => item.codigo_interno === "P8-CAT-UJ1-A"));
    console.log("OK - búsqueda server-side incluye número de serie");

    const invalidLimit = await request(base, "/api/activos/catalogo?limit=501", {
      token: adminToken,
    });
    assert.strictEqual(invalidLimit.status, 400);

    const invalidOffice = await request(base, "/api/activos/catalogo?oficina_id=abc", {
      token: adminToken,
    });
    assert.strictEqual(invalidOffice.status, 400);
    console.log("OK - límites y filtros inválidos son rechazados");
  } finally {
    if (server) await close(server);
    await sequelize.close();
  }
};

main().catch((error) => {
  console.error(`✗ Contratos P8.3 de catálogo fallaron: ${error.stack || error.message}`);
  process.exitCode = 1;
});
