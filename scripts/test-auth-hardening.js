const assert = require("assert");
const { spawnSync } = require("child_process");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const sequelize = require("../src/config/database");
const { AuthSession } = require("../src/models");
const {
  TEST_PASSWORD,
  TEST_USERS,
  resetIntegrationData,
} = require("./integration-fixtures");
const {
  JWT_ALGORITHM,
  JWT_ISSUER,
  JWT_AUDIENCE,
} = require("../src/config/jwt");

const listen = () =>
  new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
    server.once("error", reject);
  });

const close = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

const readBody = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const request = async (
  base,
  path,
  { method = "GET", token, body, rawBody, headers: extraHeaders = {} } = {},
) => {
  const headers = { Accept: "application/json", ...extraHeaders };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined || rawBody !== undefined) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body:
      rawBody !== undefined
        ? rawBody
        : body === undefined
          ? undefined
          : JSON.stringify(body),
  });

  return {
    status: response.status,
    headers: response.headers,
    body: await readBody(response),
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

const validarSecretoProduccion = () => {
  const baseEnv = {
    ...process.env,
    NODE_ENV: "production",
    DB_HOST: "127.0.0.1",
    DB_PORT: "3306",
    DB_NAME: "inventario_prod_test",
    DB_USER: "inventario_prod_test",
    DB_PASSWORD: "password_test_only",
    CORS_ORIGIN: "https://inventario.example.test",
    AUTH_TOKEN_TRANSPORT: "cookie",
    REQUIRE_ADMIN_MFA: "false",
  };

  const weak = spawnSync(
    process.execPath,
    ["-e", 'require("./src/config/env")'],
    {
      cwd: process.cwd(),
      env: { ...baseEnv, JWT_SECRET: "demasiado-corto" },
      encoding: "utf8",
    },
  );

  assert.notStrictEqual(weak.status, 0);
  assert.match(`${weak.stdout}\n${weak.stderr}`, /32 bytes/i);

  const strong = spawnSync(
    process.execPath,
    ["-e", 'require("./src/config/env")'],
    {
      cwd: process.cwd(),
      env: {
        ...baseEnv,
        JWT_SECRET: "secreto-produccion-test-con-mas-de-32-bytes-2026",
      },
      encoding: "utf8",
    },
  );

  assert.strictEqual(
    strong.status,
    0,
    `JWT_SECRET robusto debería ser aceptado: ${strong.stderr}`,
  );
  console.log("OK - production exige JWT_SECRET de al menos 32 bytes");
};

const main = async () => {
  let server;

  try {
    validarSecretoProduccion();

    const fixture = await resetIntegrationData();
    server = await listen();
    const address = server.address();
    const base = `http://127.0.0.1:${address.port}`;

    const login = async (email, password = TEST_PASSWORD, expected = 200) => {
      const result = await request(base, "/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      const body = expectStatus(result, expected, `login ${email} -> ${expected}`);
      return { ...result, token: body?.token, usuario: body?.usuario };
    };

    const root = expectStatus(
      await request(base, "/"),
      200,
      "API responde con cabeceras defensivas",
    );
    assert.ok(root);

    const rootResponse = await request(base, "/");
    assert.strictEqual(rootResponse.headers.get("x-content-type-options"), "nosniff");
    assert.strictEqual(rootResponse.headers.get("x-frame-options"), "DENY");
    assert.strictEqual(rootResponse.headers.get("referrer-policy"), "no-referrer");
    assert.strictEqual(rootResponse.headers.get("x-powered-by"), null);
    console.log("OK - Express no expone X-Powered-By y aplica headers defensivos");

    expectStatus(
      await request(base, "/api/auth/login", {
        method: "POST",
        body: {
          email: TEST_USERS.admin,
          password: "X".repeat(300),
        },
      }),
      400,
      "rechaza credencial individual excesivamente larga antes de bcrypt",
    );

    expectStatus(
      await request(base, "/api/activos", {
        headers: {
          Authorization: `Bearer ${"A".repeat(4097)}`,
        },
      }),
      401,
      "rechaza bearer token excesivamente largo antes de jwt.verify",
    );

    const adminLogin = await login(TEST_USERS.admin);
    assert.strictEqual(adminLogin.headers.get("cache-control"), "no-store");

    const decoded = jwt.decode(adminLogin.token, { complete: true });
    assert.ok(decoded?.header);
    assert.strictEqual(decoded.header.alg, JWT_ALGORITHM);
    assert.strictEqual(decoded.payload.iss, JWT_ISSUER);
    assert.strictEqual(decoded.payload.aud, JWT_AUDIENCE);
    assert.strictEqual(String(decoded.payload.sub), String(fixture.users.admin.id));
    assert.ok(decoded.payload.jti);
    assert.ok(decoded.payload.exp > decoded.payload.iat);
    console.log("OK - JWT fija algoritmo, issuer, audience, subject y jti");

    const adminSession = await AuthSession.findOne({
      where: {
        usuario_id: fixture.users.admin.id,
        jti: decoded.payload.jti,
      },
    });
    assert.ok(adminSession);
    assert.strictEqual(adminSession.revoked_at, null);
    console.log("OK - login persiste la sesión JWT en MySQL");

    expectStatus(
      await request(base, "/api/usuarios", { token: adminLogin.token }),
      200,
      "sesión persistente activa autoriza endpoint protegido",
    );

    const oldStyleToken = jwt.sign(
      { id: fixture.users.admin.id },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "5m" },
    );
    expectStatus(
      await request(base, "/api/usuarios", { token: oldStyleToken }),
      401,
      "rechaza JWT legado sin issuer/audience/jti",
    );

    const wrongAlgorithmToken = jwt.sign(
      { id: fixture.users.admin.id },
      process.env.JWT_SECRET,
      {
        algorithm: "HS384",
        expiresIn: "5m",
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        subject: String(fixture.users.admin.id),
        jwtid: "algoritmo-no-permitido-test",
      },
    );
    expectStatus(
      await request(base, "/api/usuarios", { token: wrongAlgorithmToken }),
      401,
      "rechaza algoritmo JWT distinto de HS256",
    );

    const usuarioLogin = await login(TEST_USERS.usuario1);
    const usuarioDecoded = jwt.decode(usuarioLogin.token);

    expectStatus(
      await request(base, "/api/auth/logout", {
        method: "POST",
        token: usuarioLogin.token,
      }),
      200,
      "logout revoca sesión",
    );

    const revokedSession = await AuthSession.findOne({
      where: { jti: usuarioDecoded.jti },
    });
    assert.ok(revokedSession?.revoked_at);

    expectStatus(
      await request(base, "/api/activos", { token: usuarioLogin.token }),
      401,
      "token no puede reutilizarse después de logout",
    );

    const responsableLogin = await login(TEST_USERS.responsable1);

    expectStatus(
      await request(
        base,
        `/api/usuarios/${fixture.users.responsable1.id}/estado`,
        { method: "PATCH", token: adminLogin.token },
      ),
      200,
      "admin desactiva responsable",
    );

    expectStatus(
      await request(base, "/api/activos", { token: responsableLogin.token }),
      401,
      "desactivación revoca sesiones existentes",
    );

    expectStatus(
      await request(
        base,
        `/api/usuarios/${fixture.users.responsable1.id}/estado`,
        { method: "PATCH", token: adminLogin.token },
      ),
      200,
      "admin reactiva responsable",
    );

    expectStatus(
      await request(base, "/api/activos", { token: responsableLogin.token }),
      401,
      "reactivación no revive un token revocado",
    );

    await login(TEST_USERS.responsable1, TEST_PASSWORD, 200);

    const passwordLogin = await login(TEST_USERS.usuario1);
    const nuevaPassword = "Inventario#Nueva2026A";

    expectStatus(
      await request(
        base,
        `/api/usuarios/${fixture.users.usuario1.id}/reset-password`,
        {
          method: "PATCH",
          token: adminLogin.token,
          body: { nuevaPassword },
        },
      ),
      200,
      "reset de contraseña revoca sesiones",
    );

    expectStatus(
      await request(base, "/api/activos", { token: passwordLogin.token }),
      401,
      "token previo al reset de contraseña queda inválido",
    );

    await login(TEST_USERS.usuario1, nuevaPassword, 200);

    const oversized = JSON.stringify({
      email: TEST_USERS.admin,
      password: "X".repeat(110 * 1024),
    });
    const oversizedResult = await request(base, "/api/auth/login", {
      method: "POST",
      rawBody: oversized,
    });
    expectStatus(
      oversizedResult,
      413,
      "rechaza JSON mayor al límite configurado con HTTP 413",
    );
    assert.match(
      String(oversizedResult.body?.mensaje || ""),
      /supera el tamaño permitido/i,
    );

    console.log("\n✓ Hardening de autenticación y sesiones validado contra MySQL real de test.");
  } finally {
    if (server) await close(server);
    await sequelize.close();
  }
};

main().catch((error) => {
  console.error(`✗ Hardening de autenticación falló: ${error.stack || error.message}`);
  process.exitCode = 1;
});
