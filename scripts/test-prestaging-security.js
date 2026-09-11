const assert = require("assert");
const { spawnSync } = require("child_process");
const env = require("../src/config/env");
const { securityHeaders } = require("../src/middlewares/securityHeaders");
const { trustedOrigin } = require("../src/middlewares/trustedOrigin");
const { authCookieBridge } = require("../src/middlewares/authCookieBridge");
const {
  createFixedWindowRateLimiter,
} = require("../src/middlewares/rateLimit");
const {
  AUTH_COOKIE_NAME,
  buildAuthCookie,
} = require("../src/utils/authCookie");

const VALID_MFA_KEY = Buffer.from(
  "0123456789abcdef0123456789abcdef",
  "utf8",
).toString("base64");

const mockResponse = () => {
  const headers = new Map();
  const finishListeners = [];
  const response = {
    statusCode: 200,
    body: null,
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), String(value));
    },
    getHeader(name) {
      return headers.get(String(name).toLowerCase()) || null;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    once(eventName, listener) {
      if (eventName === "finish") finishListeners.push(listener);
      return this;
    },
    emitFinish() {
      const listeners = finishListeners.splice(0, finishListeners.length);
      for (const listener of listeners) listener();
    },
  };
  return response;
};

const testHeaders = () => {
  const res = mockResponse();
  let nextCalled = false;
  securityHeaders({}, res, () => {
    nextCalled = true;
  });

  assert.ok(nextCalled);
  assert.strictEqual(res.getHeader("x-content-type-options"), "nosniff");
  assert.strictEqual(res.getHeader("x-frame-options"), "DENY");
  assert.match(res.getHeader("content-security-policy"), /default-src 'none'/);
  assert.match(res.getHeader("content-security-policy"), /frame-ancestors 'none'/);
  console.log("OK - cabeceras defensivas incluyen CSP restrictiva");
};

const testCookie = () => {
  const cookie = buildAuthCookie("jwt.test.value");
  assert.match(cookie, new RegExp(`^${AUTH_COOKIE_NAME}=`));
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);
  assert.match(cookie, /Path=\//i);
  assert.doesNotMatch(cookie, /Domain=/i);
  console.log("OK - cookie de sesión es HttpOnly, host-only y SameSite=Strict");
};

const testBridge = () => {
  const req = {
    headers: {
      cookie: `${AUTH_COOKIE_NAME}=abc.def.ghi`,
    },
  };
  let nextCalled = false;
  authCookieBridge(req, {}, () => {
    nextCalled = true;
  });
  assert.ok(nextCalled);
  assert.strictEqual(req.headers.authorization, "Bearer abc.def.ghi");
  assert.strictEqual(req.authTransport, "cookie");
  console.log("OK - cookie HttpOnly alimenta el middleware JWT existente");
};

const testOrigin = () => {
  const blockedReq = {
    method: "POST",
    headers: {
      cookie: `${AUTH_COOKIE_NAME}=abc.def.ghi`,
      origin: "https://evil.example",
    },
  };
  const blockedRes = mockResponse();
  let blockedNext = false;
  trustedOrigin(blockedReq, blockedRes, () => {
    blockedNext = true;
  });
  assert.strictEqual(blockedNext, false);
  assert.strictEqual(blockedRes.statusCode, 403);

  const allowedReq = {
    method: "POST",
    headers: {
      cookie: `${AUTH_COOKIE_NAME}=abc.def.ghi`,
      origin: env.CORS_ORIGIN,
    },
  };
  const allowedRes = mockResponse();
  let allowedNext = false;
  trustedOrigin(allowedReq, allowedRes, () => {
    allowedNext = true;
  });
  assert.ok(allowedNext);
  console.log("OK - operaciones con cookie exigen Origin confiable");
};

const testRateLimiter = () => {
  const store = new Map();
  let nowValue = 1000;
  const limiter = createFixedWindowRateLimiter({
    prefix: "test",
    windowMs: 10000,
    max: 2,
    store,
    now: () => nowValue,
  });

  const req = { ip: "127.0.0.1", headers: {}, socket: {} };

  const run = () => {
    const res = mockResponse();
    let nextCalled = false;
    limiter(req, res, () => {
      nextCalled = true;
    });
    return { res, nextCalled };
  };

  assert.ok(run().nextCalled);
  assert.ok(run().nextCalled);
  const blocked = run();
  assert.strictEqual(blocked.nextCalled, false);
  assert.strictEqual(blocked.res.statusCode, 429);
  assert.ok(Number(blocked.res.getHeader("retry-after")) >= 1);

  nowValue += 10001;
  assert.ok(run().nextCalled);
  console.log("OK - rate limiter bloquea y reinicia la ventana correctamente");
};

const testSuccessfulRequestsAreRefunded = () => {
  const store = new Map();
  const limiter = createFixedWindowRateLimiter({
    prefix: "test-login-failures",
    windowMs: 10000,
    max: 2,
    store,
    now: () => 1000,
    skipSuccessfulRequests: true,
  });
  const req = { ip: "127.0.0.2", headers: {}, socket: {} };

  const run = (statusCode) => {
    const res = mockResponse();
    let nextCalled = false;
    limiter(req, res, () => {
      nextCalled = true;
      res.statusCode = statusCode;
      res.emitFinish();
    });
    return { res, nextCalled };
  };

  for (let index = 0; index < 5; index += 1) {
    assert.ok(run(200).nextCalled);
  }

  assert.ok(run(401).nextCalled);
  assert.ok(run(401).nextCalled);
  const blocked = run(401);
  assert.strictEqual(blocked.nextCalled, false);
  assert.strictEqual(blocked.res.statusCode, 429);
  console.log("OK - éxitos no consumen el cupo; fallos consecutivos sí se limitan");
};

const testProductionConfig = () => {
  const baseEnv = {
    ...process.env,
    NODE_ENV: "production",
    DB_HOST: "127.0.0.1",
    DB_PORT: "3306",
    DB_NAME: "inventario_prod_test",
    DB_USER: "inventario_prod_test",
    DB_PASSWORD: "password_test_only",
    JWT_SECRET: "secreto-produccion-test-con-mas-de-32-bytes-2026",
    CORS_ORIGIN: "https://inventario.example.test",
    REQUIRE_ADMIN_MFA: "true",
    MFA_ENCRYPTION_KEY: VALID_MFA_KEY,
  };

  const insecure = spawnSync(
    process.execPath,
    ["-e", 'require("./src/config/env")'],
    {
      cwd: process.cwd(),
      env: { ...baseEnv, AUTH_TOKEN_TRANSPORT: "hybrid" },
      encoding: "utf8",
    },
  );
  assert.notStrictEqual(insecure.status, 0);
  assert.match(`${insecure.stdout}\n${insecure.stderr}`, /debe ser cookie/i);

  const missingMfaKey = spawnSync(
    process.execPath,
    ["-e", 'require("./src/config/env")'],
    {
      cwd: process.cwd(),
      env: {
        ...baseEnv,
        AUTH_TOKEN_TRANSPORT: "cookie",
        MFA_ENCRYPTION_KEY: "",
      },
      encoding: "utf8",
    },
  );
  assert.notStrictEqual(missingMfaKey.status, 0);
  assert.match(`${missingMfaKey.stdout}\n${missingMfaKey.stderr}`, /MFA_ENCRYPTION_KEY/i);

  const secure = spawnSync(
    process.execPath,
    ["-e", 'require("./src/config/env")'],
    {
      cwd: process.cwd(),
      env: { ...baseEnv, AUTH_TOKEN_TRANSPORT: "cookie" },
      encoding: "utf8",
    },
  );
  assert.strictEqual(secure.status, 0, secure.stderr);
  console.log("OK - production exige cookie HttpOnly y clave MFA separada");
};

testHeaders();
testCookie();
testBridge();
testOrigin();
testRateLimiter();
testSuccessfulRequestsAreRefunded();
testProductionConfig();
console.log("\n✓ Baseline de seguridad pre-staging validado.");
