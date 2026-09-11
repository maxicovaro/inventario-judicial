require("dotenv").config();

const text = (value) => String(value ?? "").trim();

const normalizeOrigin = (name, value, { requireHttps = true } = {}) => {
  const raw = text(value);
  if (!raw) throw new Error(`Falta ${name}`);

  const url = new URL(raw);
  const originOnly =
    url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password;

  if (!originOnly) {
    throw new Error(`${name} debe ser un origen sin ruta, query ni fragmento`);
  }
  if (requireHttps && url.protocol !== "https:") {
    throw new Error(`${name} debe usar https://`);
  }

  return url.origin;
};

const fetchWithTimeout = async (url, options = {}) => {
  const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 5000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();

  try {
    return await fetch(url, {
      redirect: "manual",
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

const expectJson = async (url, expectedStatus, expectedBody = {}) => {
  const response = await fetchWithTimeout(url, {
    headers: { Accept: "application/json" },
  });

  if (response.status !== expectedStatus) {
    throw new Error(`${url} respondió HTTP ${response.status}; se esperaba ${expectedStatus}`);
  }

  const body = await response.json();
  for (const [key, expected] of Object.entries(expectedBody)) {
    if (body?.[key] !== expected) {
      throw new Error(`${url} devolvió ${key}=${body?.[key]}; se esperaba ${expected}`);
    }
  }

  return { response, body };
};

const main = async () => {
  const deployEnv = text(process.env.DEPLOY_ENV).toLowerCase();
  const requireHttps = deployEnv === "staging" || deployEnv === "production";
  const apiOrigin = normalizeOrigin("SMOKE_API_ORIGIN", process.env.SMOKE_API_ORIGIN, {
    requireHttps,
  });
  const frontendOrigin = normalizeOrigin(
    "SMOKE_FRONTEND_ORIGIN",
    process.env.SMOKE_FRONTEND_ORIGIN,
    { requireHttps },
  );

  await expectJson(`${apiOrigin}/health/live`, 200, {
    status: "ok",
    service: "inventario-judicial",
  });
  console.log("✓ /health/live responde correctamente.");

  await expectJson(`${apiOrigin}/health/ready`, 200, {
    status: "ready",
    service: "inventario-judicial",
  });
  console.log("✓ /health/ready confirma acceso a MySQL.");

  const frontendResponse = await fetchWithTimeout(`${frontendOrigin}/`, {
    headers: { Accept: "text/html" },
  });
  if (frontendResponse.status !== 200) {
    throw new Error(
      `${frontendOrigin}/ respondió HTTP ${frontendResponse.status}; se esperaba 200`,
    );
  }
  const frontendHtml = await frontendResponse.text();
  if (!/id=["']root["']/.test(frontendHtml)) {
    throw new Error("El frontend no contiene el contenedor raíz esperado");
  }
  console.log("✓ Frontend accesible y con raíz de aplicación.");

  const authProbe = await fetchWithTimeout(`${apiOrigin}/api/auth/me`, {
    headers: {
      Accept: "application/json",
      Origin: frontendOrigin,
    },
  });

  if (authProbe.status !== 401) {
    throw new Error(
      `/api/auth/me sin sesión respondió HTTP ${authProbe.status}; se esperaba 401`,
    );
  }

  const allowOrigin = authProbe.headers.get("access-control-allow-origin");
  const allowCredentials = authProbe.headers.get("access-control-allow-credentials");
  if (allowOrigin !== frontendOrigin || allowCredentials !== "true") {
    throw new Error(
      "El contrato CORS con credenciales no coincide con el frontend de staging",
    );
  }
  console.log("✓ CORS/origin permite exactamente el frontend configurado con credenciales.");

  console.log("✓ Smoke test post-deploy completado.");
};

if (require.main === module) {
  main().catch((error) => {
    console.error(`✗ Smoke test falló: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  expectJson,
  fetchWithTimeout,
  normalizeOrigin,
};
