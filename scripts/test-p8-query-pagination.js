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

const main = async () => {
  let server;
  try {
    const fixture = await resetIntegrationData();

    const rows = Array.from({ length: 42 }, (_, index) => ({
      codigo_interno: `P8-PAG-${String(index + 1).padStart(3, "0")}`,
      nombre: `Activo paginado ${index + 1}`,
      marca: index % 2 === 0 ? "Marca Par" : "Marca Impar",
      modelo: `Modelo ${index % 5}`,
      numero_serie: `SER-P8-${index + 1}`,
      cantidad: 1,
      estado: index % 7 === 0 ? "Regular estado" : "Buen estado",
      categoria_id: fixture.categoria.id,
      oficina_id:
        index % 2 === 0 ? fixture.offices.uj1.id : fixture.offices.uj2.id,
      activo: true,
    }));
    await Activo.bulkCreate(rows, { validate: true });

    server = await listen();
    const base = `http://127.0.0.1:${server.address().port}`;
    const [adminToken, responsable1Token] = await Promise.all([
      login(base, TEST_USERS.admin),
      login(base, TEST_USERS.responsable1),
    ]);

    const firstPage = await request(base, "/api/activos?page=1&page_size=10", {
      token: adminToken,
    });
    assert.strictEqual(firstPage.status, 200);
    assert.ok(Array.isArray(firstPage.body.items));
    assert.strictEqual(firstPage.body.items.length, 10);
    assert.strictEqual(firstPage.body.pagination.page, 1);
    assert.strictEqual(firstPage.body.pagination.page_size, 10);
    assert.ok(firstPage.body.pagination.total >= 42);
    assert.ok(firstPage.body.pagination.total_pages >= 5);
    assert.ok(firstPage.body.summary.total >= 42);
    assert.ok(firstPage.body.items.every((item) => item.descripcion === undefined));
    assert.ok(firstPage.body.items.every((item) => item.observaciones === undefined));
    console.log("OK - listado global paginado y proyectado");

    const search = await request(
      base,
      "/api/activos?page=1&page_size=25&q=P8-PAG-037",
      { token: adminToken },
    );
    assert.strictEqual(search.status, 200);
    assert.strictEqual(search.body.pagination.total, 1);
    assert.strictEqual(search.body.items[0].codigo_interno, "P8-PAG-037");
    console.log("OK - búsqueda server-side");

    const officeFilter = await request(
      base,
      `/api/activos?page=1&page_size=100&oficina_id=${fixture.offices.uj2.id}`,
      { token: adminToken },
    );
    assert.strictEqual(officeFilter.status, 200);
    assert.ok(officeFilter.body.items.length > 0);
    assert.ok(
      officeFilter.body.items.every(
        (item) => Number(item.oficina_id) === Number(fixture.offices.uj2.id),
      ),
    );
    console.log("OK - filtro de oficina para Dirección");

    const responsableScope = await request(
      base,
      `/api/activos?page=1&page_size=100&oficina_id=${fixture.offices.uj2.id}`,
      { token: responsable1Token },
    );
    assert.strictEqual(responsableScope.status, 200);
    assert.ok(
      responsableScope.body.items.every(
        (item) => Number(item.oficina_id) === Number(fixture.offices.uj1.id),
      ),
    );
    console.log("OK - filtro de oficina no amplía alcance de RESPONSABLE");

    const ownAsset = responsableScope.body.items.find((item) =>
      String(item.codigo_interno || "").startsWith("P8-PAG-"),
    );
    assert.ok(ownAsset);
    const ownDetail = await request(base, `/api/activos/${ownAsset.id}`, {
      token: responsable1Token,
    });
    assert.strictEqual(ownDetail.status, 200);
    assert.ok(Object.prototype.hasOwnProperty.call(ownDetail.body, "descripcion"));

    const otherAsset = officeFilter.body.items.find((item) =>
      String(item.codigo_interno || "").startsWith("P8-PAG-"),
    );
    assert.ok(otherAsset);
    const deniedDetail = await request(base, `/api/activos/${otherAsset.id}`, {
      token: responsable1Token,
    });
    assert.strictEqual(deniedDetail.status, 404);

    const adminDetail = await request(base, `/api/activos/${otherAsset.id}`, {
      token: adminToken,
    });
    assert.strictEqual(adminDetail.status, 200);
    console.log("OK - detalle respeta alcance por oficina");

    const invalid = await request(base, "/api/activos?page=0&page_size=500", {
      token: adminToken,
    });
    assert.strictEqual(invalid.status, 400);
    console.log("OK - límites de paginación validados");
  } finally {
    if (server) await close(server);
    await sequelize.close();
  }
};

main().catch((error) => {
  console.error(`✗ Contratos P8.2 fallaron: ${error.stack || error.message}`);
  process.exitCode = 1;
});
