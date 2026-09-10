const assert = require("assert");
const app = require("../src/app");
const sequelize = require("../src/config/database");
const { Usuario } = require("../src/models");
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

const request = async (base, path, { method = "GET", token, body } = {}) => {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let responseBody = null;
  if (text) {
    try {
      responseBody = JSON.parse(text);
    } catch {
      responseBody = text;
    }
  }

  return {
    status: response.status,
    body: responseBody,
  };
};

const expectStatus = (result, expected, label) => {
  assert.strictEqual(
    result.status,
    expected,
    `${label}: esperaba HTTP ${expected}, obtuvo ${result.status}. Respuesta: ${JSON.stringify(result.body)}`,
  );
  console.log(`OK - ${label}`);
  return result.body;
};

const main = async () => {
  let server;

  try {
    const fixture = await resetIntegrationData();
    server = await listen();
    const base = `http://127.0.0.1:${server.address().port}`;

    const login = async (email, password, expected) => {
      const result = await request(base, "/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      const body = expectStatus(
        result,
        expected,
        `login ${email} -> ${expected}`,
      );
      return { ...result, token: body?.token };
    };

    const admin = await login(TEST_USERS.admin, TEST_PASSWORD, 200);
    assert.ok(admin.token);

    const passwordIncorrecta = "Incorrecta#Concurrente2026";
    const resultados = await Promise.all(
      Array.from({ length: 3 }, () =>
        request(base, "/api/auth/login", {
          method: "POST",
          body: {
            email: TEST_USERS.responsable2,
            password: passwordIncorrecta,
          },
        }),
      ),
    );

    for (const [index, resultado] of resultados.entries()) {
      expectStatus(
        resultado,
        401,
        `intento incorrecto concurrente ${index + 1}`,
      );
    }

    const usuarioBloqueado = await Usuario.findByPk(fixture.users.responsable2.id);
    assert.strictEqual(Number(usuarioBloqueado.intentos_fallidos), 3);
    assert.ok(usuarioBloqueado.bloqueado_hasta);
    assert.ok(new Date(usuarioBloqueado.bloqueado_hasta) > new Date());
    console.log("OK - los tres intentos concurrentes se contabilizaron sin actualización perdida");

    await login(TEST_USERS.responsable2, TEST_PASSWORD, 403);

    expectStatus(
      await request(
        base,
        `/api/usuarios/${fixture.users.responsable2.id}/desbloquear`,
        {
          method: "PATCH",
          token: admin.token,
        },
      ),
      200,
      "admin desbloquea cuenta tras carrera de login",
    );

    const recuperado = await login(TEST_USERS.responsable2, TEST_PASSWORD, 200);
    assert.ok(recuperado.token);

    const usuarioRecuperado = await Usuario.findByPk(fixture.users.responsable2.id);
    assert.strictEqual(Number(usuarioRecuperado.intentos_fallidos), 0);
    assert.strictEqual(usuarioRecuperado.bloqueado_hasta, null);
    console.log("OK - desbloqueo administrativo permite un login limpio posterior");

    console.log("\n✓ Concurrencia de intentos de login validada contra MySQL.");
  } finally {
    if (server) await close(server);
    await sequelize.close();
  }
};

main().catch((error) => {
  console.error(`✗ Concurrencia de login falló: ${error.stack || error.message}`);
  process.exitCode = 1;
});
