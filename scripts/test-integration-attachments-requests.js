const assert = require("assert");
const app = require("../src/app");
const sequelize = require("../src/config/database");
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
  });

const jsonRequest = async (base, path, { method = "GET", token, body } = {}) => {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  return { status: response.status, body: payload };
};

const expectStatus = (result, expected, label) => {
  assert.strictEqual(
    result.status,
    expected,
    `${label}: esperado ${expected}, recibido ${result.status}: ${JSON.stringify(result.body)}`,
  );
  console.log(`OK - ${label}`);
  return result.body;
};

const main = async () => {
  let server;

  try {
    const fixture = await resetIntegrationData();
    server = await listen();
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;

    const login = async (email) => {
      const result = await jsonRequest(base, "/api/auth/login", {
        method: "POST",
        body: { email, password: TEST_PASSWORD },
      });
      const body = expectStatus(result, 200, `login ${email}`);
      return body.token;
    };

    const [adminToken, responsable1Token, responsable2Token, usuario1Token] =
      await Promise.all([
        login(TEST_USERS.admin),
        login(TEST_USERS.responsable1),
        login(TEST_USERS.responsable2),
        login(TEST_USERS.usuario1),
      ]);

    // Solicitudes: creación y alcance por oficina.
    const descripcion = "Solicitud de integración para reposición controlada";
    const solicitudBody = expectStatus(
      await jsonRequest(base, "/api/solicitudes", {
        method: "POST",
        token: responsable1Token,
        body: {
          tipo: "REPOSICION",
          descripcion,
          prioridad: "ALTA",
          oficina_id: fixture.offices.uj1.id,
          activo_id: fixture.activoBase.id,
        },
      }),
      201,
      "RESPONSABLE UJ1 crea solicitud propia",
    );
    const solicitudId = solicitudBody.solicitud.id;

    const listaUj2 = expectStatus(
      await jsonRequest(base, "/api/solicitudes", { token: responsable2Token }),
      200,
      "RESPONSABLE UJ2 lista solicitudes",
    );
    assert.ok(!listaUj2.some((item) => Number(item.id) === Number(solicitudId)));
    console.log("OK - UJ2 no ve solicitud de UJ1");

    const listaUsuarioUj1 = expectStatus(
      await jsonRequest(base, "/api/solicitudes", { token: usuario1Token }),
      200,
      "USUARIO UJ1 lista solicitudes de su oficina",
    );
    assert.ok(listaUsuarioUj1.some((item) => Number(item.id) === Number(solicitudId)));

    expectStatus(
      await jsonRequest(base, `/api/solicitudes/${solicitudId}`, {
        token: responsable2Token,
      }),
      403,
      "UJ2 no abre solicitud de UJ1 por ID",
    );

    expectStatus(
      await jsonRequest(base, `/api/solicitudes/${solicitudId}`, {
        method: "PUT",
        token: adminToken,
        body: { estado: "APROBADA", respuesta_admin: "Aprobada en integración" },
      }),
      200,
      "Admin General aprueba solicitud",
    );

    expectStatus(
      await jsonRequest(base, `/api/solicitudes/${solicitudId}`, {
        method: "PUT",
        token: responsable1Token,
        body: { descripcion: "Intento de edición posterior" },
      }),
      403,
      "oficina no modifica solicitud ya revisada",
    );

    // Adjuntos: subida real multipart, listado global scoped y descarga cruzada bloqueada.
    const form = new FormData();
    form.append("activo_id", String(fixture.activoBase.id));
    form.append(
      "archivo",
      new Blob(
        ["%PDF-1.4\n% Inventario integration attachment\n1 0 obj\n<<>>\nendobj\n%%EOF\n"],
        { type: "application/pdf" },
      ),
      "integracion-adjunto.pdf",
    );

    const uploadResponse = await fetch(`${base}/api/adjuntos`, {
      method: "POST",
      headers: { Authorization: `Bearer ${responsable1Token}` },
      body: form,
    });
    const uploadPayload = await uploadResponse.json();
    assert.strictEqual(
      uploadResponse.status,
      201,
      `subida de adjunto: ${JSON.stringify(uploadPayload)}`,
    );
    const adjuntoId = uploadPayload.adjunto.id;
    console.log("OK - RESPONSABLE UJ1 sube PDF real a activo propio");

    const adjuntosUj1 = expectStatus(
      await jsonRequest(base, "/api/adjuntos", { token: responsable1Token }),
      200,
      "listado global de adjuntos funciona para UJ1",
    );
    assert.ok(adjuntosUj1.some((item) => Number(item.id) === Number(adjuntoId)));

    const adjuntosUsuarioUj1 = expectStatus(
      await jsonRequest(base, "/api/adjuntos", { token: usuario1Token }),
      200,
      "USUARIO UJ1 ve adjuntos de activos de su oficina",
    );
    assert.ok(
      adjuntosUsuarioUj1.some((item) => Number(item.id) === Number(adjuntoId)),
    );

    const adjuntosUj2 = expectStatus(
      await jsonRequest(base, "/api/adjuntos", { token: responsable2Token }),
      200,
      "listado global de UJ2 responde sin filtrar datos ajenos",
    );
    assert.ok(!adjuntosUj2.some((item) => Number(item.id) === Number(adjuntoId)));
    console.log("OK - UJ2 no recibe metadata del adjunto de UJ1");

    const adjuntosAdmin = expectStatus(
      await jsonRequest(base, "/api/adjuntos", { token: adminToken }),
      200,
      "Admin General lista adjuntos globales",
    );
    assert.ok(adjuntosAdmin.some((item) => Number(item.id) === Number(adjuntoId)));

    const forbiddenDownload = await fetch(
      `${base}/api/adjuntos/${adjuntoId}/download`,
      { headers: { Authorization: `Bearer ${responsable2Token}` } },
    );
    assert.strictEqual(forbiddenDownload.status, 403);
    console.log("OK - UJ2 no descarga archivo de UJ1 por ID directo");

    const allowedDownload = await fetch(
      `${base}/api/adjuntos/${adjuntoId}/download`,
      { headers: { Authorization: `Bearer ${responsable1Token}` } },
    );
    assert.strictEqual(allowedDownload.status, 200);
    assert.ok((await allowedDownload.arrayBuffer()).byteLength > 0);
    console.log("OK - UJ1 descarga su archivo real");

    expectStatus(
      await jsonRequest(base, `/api/adjuntos/${adjuntoId}`, {
        method: "DELETE",
        token: responsable2Token,
      }),
      403,
      "UJ2 no elimina adjunto de UJ1",
    );

    expectStatus(
      await jsonRequest(base, `/api/adjuntos/${adjuntoId}`, {
        method: "DELETE",
        token: responsable1Token,
      }),
      200,
      "UJ1 elimina su adjunto y archivo físico",
    );

    const finalList = expectStatus(
      await jsonRequest(base, "/api/adjuntos", { token: responsable1Token }),
      200,
      "listado final de adjuntos UJ1",
    );
    assert.ok(!finalList.some((item) => Number(item.id) === Number(adjuntoId)));

    console.log("");
    console.log("✓ P4 solicitudes y adjuntos: integración y aislamiento validados.");
  } finally {
    if (server) await close(server);
    await sequelize.close();
  }
};

main().catch((error) => {
  console.error("");
  console.error(`✗ Integración de solicitudes/adjuntos falló: ${error.stack || error.message}`);
  process.exitCode = 1;
});
