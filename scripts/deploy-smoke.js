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

const deploymentExpectation = (input = process.env) => {
  const environment = text(input.DEPLOY_ENV).toLowerCase();
  const revision = text(input.DEPLOY_REVISION);

  if (!["staging", "production"].includes(environment)) {
    throw new Error("DEPLOY_ENV debe ser staging o production para ejecutar el smoke de despliegue");
  }
  if (!revision) {
    throw new Error("Falta DEPLOY_REVISION para verificar la revisión desplegada");
  }

  return { environment, revision };
};

const smokeTimeoutMs = () => {
  const value = Number(process.env.SMOKE_TIMEOUT_MS || 5000);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("SMOKE_TIMEOUT_MS debe ser un entero positivo");
  }
  return value;
};

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), smokeTimeoutMs());
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
  const expectedDeployment = deploymentExpectation(process.env);
  const requireHttps = true;
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
    ...expectedDeployment,
  });
  console.log(
    `✓ /health/live confirma ${expectedDeployment.environment}@${expectedDeployment.revision}.`,
  );

  await expectJson(`${apiOrigin}/health/ready`, 200, {
    status: "ready",
    service: "inventario-judicial",
    ...expectedDeployment,
  });
  console.log("✓ /health/ready confirma revisión esperada y acceso a MySQL.");

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
  deploymentExpectation,
  expectJson,
  fetchWithTimeout,
  normalizeOrigin,
  smokeTimeoutMs,
};
