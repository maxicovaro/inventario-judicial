const assert = require("assert");
const env = require("../src/config/env");
const app = require("../src/app");
const sequelize = require("../src/config/database");
const { Usuario } = require("../src/models");
const {
  TEST_PASSWORD,
  TEST_USERS,
  resetIntegrationData,
} = require("./integration-fixtures");
const { totpAt } = require("../src/utils/mfa");

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
  { method = "GET", body, cookie, origin } = {},
) => {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;
  if (origin) headers.Origin = origin;

  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const setCookie = response.headers.get("set-cookie");
  return {
    status: response.status,
    headers: response.headers,
    setCookie,
    cookie: setCookie ? setCookie.split(";", 1)[0] : null,
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
  return result;
};

const postWithCookie = (base, path, cookie, body) =>
  request(base, path, {
    method: "POST",
    cookie,
    origin: env.CORS_ORIGIN,
    body,
  });

const main = async () => {
  let server;

  try {
    assert.strictEqual(env.REQUIRE_ADMIN_MFA, true);
    assert.strictEqual(env.AUTH_TOKEN_TRANSPORT, "cookie");

    assert.strictEqual(
      totpAt("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59000),
      "287082",
      "TOTP RFC 6238/SHA1 no coincide con el vector esperado",
    );
    console.log("OK - implementación TOTP coincide con vector RFC 6238");

    const fixture = await resetIntegrationData();
    server = await listen();
    const address = server.address();
    const base = `http://127.0.0.1:${address.port}`;

    const login = async (email, password = TEST_PASSWORD, expected = 200) => {
      const result = await request(base, "/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      expectStatus(result, expected, `login ${email} -> ${expected}`);
      assert.ok(result.cookie, "Login debe emitir cookie de sesión");
      assert.match(result.setCookie, /HttpOnly/i);
      assert.match(result.setCookie, /SameSite=Strict/i);
      assert.strictEqual(result.body?.token, undefined);
      return result;
    };

    const firstAdmin = await login(TEST_USERS.admin, TEST_PASSWORD, 202);
    assert.strictEqual(firstAdmin.body?.mfa_setup_required, true);
    assert.strictEqual(firstAdmin.body?.mfa_required, false);

    const meBeforeSetup = expectStatus(
      await request(base, "/api/auth/me", { cookie: firstAdmin.cookie }),
      202,
      "auth/me restaura sesión pendiente de configurar MFA",
    );
    assert.strictEqual(meBeforeSetup.body?.mfa_setup_required, true);
    assert.strictEqual(meBeforeSetup.body?.usuario?.role, "ADMIN");

    const blockedBeforeSetup = expectStatus(
      await request(base, "/api/usuarios", { cookie: firstAdmin.cookie }),
      403,
      "ADMIN no accede antes de configurar MFA",
    );
    assert.strictEqual(blockedBeforeSetup.body?.codigo, "MFA_SETUP_REQUIRED");

    const setup = expectStatus(
      await postWithCookie(base, "/api/auth/mfa/setup", firstAdmin.cookie, {}),
      200,
      "ADMIN inicia configuración MFA",
    );
    const secret = setup.body?.secret;
    assert.match(String(secret || ""), /^[A-Z2-7]{20,}$/);
    assert.match(String(setup.body?.otpauth_uri || ""), /^otpauth:\/\/totp\//);

    const adminDbPending = await Usuario.findByPk(fixture.users.admin.id);
    assert.ok(adminDbPending.mfa_pending_secret_enc);
    assert.notStrictEqual(adminDbPending.mfa_pending_secret_enc, secret);
    assert.match(adminDbPending.mfa_pending_secret_enc, /^v1\./);
    console.log("OK - secreto TOTP pendiente queda cifrado en MySQL");

    const currentCode = totpAt(secret);
    const confirmed = expectStatus(
      await postWithCookie(base, "/api/auth/mfa/confirm", firstAdmin.cookie, {
        code: currentCode,
      }),
      200,
      "ADMIN confirma MFA con TOTP válido",
    );

    const recoveryCodes = confirmed.body?.recovery_codes;
    assert.ok(Array.isArray(recoveryCodes));
    assert.strictEqual(recoveryCodes.length, 8);
    assert.ok(recoveryCodes.every((code) => /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)));

    const adminDbEnabled = await Usuario.findByPk(fixture.users.admin.id);
    assert.strictEqual(Boolean(adminDbEnabled.mfa_enabled), true);
    assert.notStrictEqual(adminDbEnabled.mfa_secret_enc, secret);
    assert.doesNotMatch(
      String(adminDbEnabled.mfa_recovery_codes || ""),
      new RegExp(recoveryCodes[0].replace(/-/g, ""), "i"),
    );
    console.log("OK - códigos de recuperación no se almacenan en texto plano");

    const meAfterSetup = expectStatus(
      await request(base, "/api/auth/me", { cookie: firstAdmin.cookie }),
      200,
      "auth/me confirma sesión MFA habilitada",
    );
    assert.strictEqual(meAfterSetup.body?.mfa_verified, true);

    expectStatus(
      await request(base, "/api/usuarios", { cookie: firstAdmin.cookie }),
      200,
      "sesión ADMIN obtiene privilegios después de confirmar MFA",
    );

    expectStatus(
      await postWithCookie(base, "/api/auth/logout", firstAdmin.cookie),
      200,
      "logout de sesión MFA",
    );

    const secondAdmin = await login(TEST_USERS.admin, TEST_PASSWORD, 202);
    assert.strictEqual(secondAdmin.body?.mfa_required, true);
    assert.strictEqual(secondAdmin.body?.mfa_setup_required, false);

    const blockedBeforeVerify = expectStatus(
      await request(base, "/api/usuarios", { cookie: secondAdmin.cookie }),
      403,
      "ADMIN con MFA habilitado no accede antes del segundo factor",
    );
    assert.strictEqual(blockedBeforeVerify.body?.codigo, "MFA_REQUIRED");

    expectStatus(
      await postWithCookie(base, "/api/auth/mfa/verify", secondAdmin.cookie, {
        code: totpAt(secret),
      }),
      200,
      "TOTP desbloquea la sesión administrativa",
    );

    expectStatus(
      await request(base, "/api/usuarios", { cookie: secondAdmin.cookie }),
      200,
      "ADMIN accede luego de verificar segundo factor",
    );

    expectStatus(
      await postWithCookie(base, "/api/auth/mfa/disable", secondAdmin.cookie, {
        password: TEST_PASSWORD,
        code: totpAt(secret),
      }),
      409,
      "ADMIN no puede deshabilitar MFA cuando es obligatorio",
    );

    expectStatus(
      await postWithCookie(base, "/api/auth/logout", secondAdmin.cookie),
      200,
      "logout antes de probar recovery code",
    );

    const recoveryLogin = await login(TEST_USERS.admin, TEST_PASSWORD, 202);
    expectStatus(
      await postWithCookie(base, "/api/auth/mfa/verify", recoveryLogin.cookie, {
        code: recoveryCodes[0],
      }),
      200,
      "código de recuperación válido desbloquea la sesión",
    );

    expectStatus(
      await postWithCookie(base, "/api/auth/logout", recoveryLogin.cookie),
      200,
      "logout después de recovery code",
    );

    const reuseLogin = await login(TEST_USERS.admin, TEST_PASSWORD, 202);
    expectStatus(
      await postWithCookie(base, "/api/auth/mfa/verify", reuseLogin.cookie, {
        code: recoveryCodes[0],
      }),
      401,
      "código de recuperación no puede reutilizarse",
    );

    const normalUser = await login(TEST_USERS.usuario1, TEST_PASSWORD, 200);
    assert.strictEqual(normalUser.body?.mfa_required, undefined);
    const meNormal = expectStatus(
      await request(base, "/api/auth/me", { cookie: normalUser.cookie }),
      200,
      "auth/me restaura sesión de usuario sin MFA obligatorio",
    );
    assert.strictEqual(meNormal.body?.usuario?.email, TEST_USERS.usuario1);

    expectStatus(
      await request(base, "/api/activos", { cookie: normalUser.cookie }),
      200,
      "MFA obligatorio de ADMIN no bloquea usuarios normales",
    );

    console.log("\n✓ MFA ADMIN validado de extremo a extremo contra MySQL de test.");
  } finally {
    if (server) await close(server);
    await sequelize.close();
  }
};

main().catch((error) => {
  console.error(`✗ MFA pre-staging falló: ${error.stack || error.message}`);
  process.exitCode = 1;
});
