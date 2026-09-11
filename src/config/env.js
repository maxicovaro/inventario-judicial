require("dotenv").config();

const NODE_ENV = process.env.NODE_ENV || "development";
const entornosPermitidos = new Set(["development", "test", "production"]);

if (!entornosPermitidos.has(NODE_ENV)) {
  throw new Error(
    `NODE_ENV inválido: ${NODE_ENV}. Usá development, test o production`,
  );
}

const DEPLOY_ENV = String(process.env.DEPLOY_ENV || NODE_ENV)
  .trim()
  .toLowerCase();
const deployEnvironments = new Set([
  "development",
  "test",
  "staging",
  "production",
]);

if (!deployEnvironments.has(DEPLOY_ENV)) {
  throw new Error(
    `DEPLOY_ENV inválido: ${DEPLOY_ENV}. Usá development, test, staging o production`,
  );
}

if (["staging", "production"].includes(DEPLOY_ENV) && NODE_ENV !== "production") {
  throw new Error(
    `${DEPLOY_ENV} debe ejecutar NODE_ENV=production para conservar las protecciones de seguridad`,
  );
}

if (
  NODE_ENV === "production" &&
  !["staging", "production"].includes(DEPLOY_ENV)
) {
  throw new Error(
    "NODE_ENV=production requiere DEPLOY_ENV=staging o production",
  );
}

const requerir = (nombre) => {
  const valor = process.env[nombre];
  if (valor === undefined || String(valor).trim() === "") {
    throw new Error(`Falta la variable de entorno requerida: ${nombre}`);
  }
  return String(valor).trim();
};

const numeroPositivo = (nombre, valor, fallback) => {
  const candidato = valor === undefined || valor === "" ? fallback : Number(valor);
  if (!Number.isInteger(candidato) || candidato <= 0) {
    throw new Error(`${nombre} debe ser un entero positivo`);
  }
  return candidato;
};

const numeroNoNegativo = (nombre, valor, fallback) => {
  const candidato = valor === undefined || valor === "" ? fallback : Number(valor);
  if (!Number.isInteger(candidato) || candidato < 0) {
    throw new Error(`${nombre} debe ser un entero mayor o igual a cero`);
  }
  return candidato;
};

const booleano = (nombre, valor, fallback) => {
  if (valor === undefined || valor === "") return fallback;
  const normalizado = String(valor).trim().toLowerCase();
  if (["true", "1", "yes", "si"].includes(normalizado)) return true;
  if (["false", "0", "no"].includes(normalizado)) return false;
  throw new Error(`${nombre} debe ser true o false`);
};

const transportesAuthPermitidos = new Set(["hybrid", "cookie"]);
const authTokenTransport = String(
  process.env.AUTH_TOKEN_TRANSPORT ||
    (NODE_ENV === "production" ? "cookie" : "hybrid"),
)
  .trim()
  .toLowerCase();

if (!transportesAuthPermitidos.has(authTokenTransport)) {
  throw new Error("AUTH_TOKEN_TRANSPORT debe ser hybrid o cookie");
}

const env = {
  NODE_ENV,
  DEPLOY_ENV,
  DEPLOY_REVISION: process.env.DEPLOY_REVISION?.trim() || "",
  IS_PRODUCTION: NODE_ENV === "production",
  PORT: numeroPositivo("PORT", process.env.PORT, 3000),
  DB_HOST: requerir("DB_HOST"),
  DB_PORT: numeroPositivo("DB_PORT", process.env.DB_PORT, 3306),
  DB_NAME: requerir("DB_NAME"),
  DB_USER: requerir("DB_USER"),
  DB_PASSWORD: requerir("DB_PASSWORD"),
  JWT_SECRET: requerir("JWT_SECRET"),
  CORS_ORIGIN:
    process.env.CORS_ORIGIN?.trim() ||
    (NODE_ENV === "development" ? "http://localhost:5173" : ""),
  AUTH_TOKEN_TRANSPORT: authTokenTransport,
  TRUST_PROXY_HOPS: numeroNoNegativo(
    "TRUST_PROXY_HOPS",
    process.env.TRUST_PROXY_HOPS,
    0,
  ),
  LOGIN_RATE_LIMIT_WINDOW_MS: numeroPositivo(
    "LOGIN_RATE_LIMIT_WINDOW_MS",
    process.env.LOGIN_RATE_LIMIT_WINDOW_MS,
    10 * 60 * 1000,
  ),
  LOGIN_RATE_LIMIT_MAX: numeroPositivo(
    "LOGIN_RATE_LIMIT_MAX",
    process.env.LOGIN_RATE_LIMIT_MAX,
    20,
  ),
  MFA_RATE_LIMIT_WINDOW_MS: numeroPositivo(
    "MFA_RATE_LIMIT_WINDOW_MS",
    process.env.MFA_RATE_LIMIT_WINDOW_MS,
    10 * 60 * 1000,
  ),
  MFA_RATE_LIMIT_MAX: numeroPositivo(
    "MFA_RATE_LIMIT_MAX",
    process.env.MFA_RATE_LIMIT_MAX,
    10,
  ),
  REQUIRE_ADMIN_MFA: booleano(
    "REQUIRE_ADMIN_MFA",
    process.env.REQUIRE_ADMIN_MFA,
    NODE_ENV === "production",
  ),
  MFA_ENCRYPTION_KEY: process.env.MFA_ENCRYPTION_KEY?.trim() || "",
  MFA_ISSUER: process.env.MFA_ISSUER?.trim() || "Inventario Judicial",
  HEALTH_DB_TIMEOUT_MS: numeroPositivo(
    "HEALTH_DB_TIMEOUT_MS",
    process.env.HEALTH_DB_TIMEOUT_MS,
    2000,
  ),
  SHUTDOWN_TIMEOUT_MS: numeroPositivo(
    "SHUTDOWN_TIMEOUT_MS",
    process.env.SHUTDOWN_TIMEOUT_MS,
    10000,
  ),
};

if (env.IS_PRODUCTION && !env.CORS_ORIGIN) {
  throw new Error("Falta la variable de entorno requerida en production: CORS_ORIGIN");
}

if (env.IS_PRODUCTION) {
  try {
    const corsOrigin = new URL(env.CORS_ORIGIN);
    const isOriginOnly =
      corsOrigin.pathname === "/" &&
      !corsOrigin.search &&
      !corsOrigin.hash &&
      !corsOrigin.username &&
      !corsOrigin.password;

    if (corsOrigin.protocol !== "https:" || !isOriginOnly) {
      throw new Error("invalid_origin");
    }
  } catch {
    throw new Error(
      "CORS_ORIGIN debe ser un origen HTTPS válido y sin ruta en production",
    );
  }
}

if (env.IS_PRODUCTION && Buffer.byteLength(env.JWT_SECRET, "utf8") < 32) {
  throw new Error(
    "JWT_SECRET debe tener al menos 32 bytes en production",
  );
}

if (env.IS_PRODUCTION && env.AUTH_TOKEN_TRANSPORT !== "cookie") {
  throw new Error(
    "AUTH_TOKEN_TRANSPORT debe ser cookie en production para evitar exponer JWT al navegador",
  );
}

if (env.MFA_ENCRYPTION_KEY) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(env.MFA_ENCRYPTION_KEY)) {
    throw new Error("MFA_ENCRYPTION_KEY debe estar codificada en Base64");
  }
  const key = Buffer.from(env.MFA_ENCRYPTION_KEY, "base64");
  if (key.length !== 32) {
    throw new Error("MFA_ENCRYPTION_KEY debe representar exactamente 32 bytes");
  }
}

if (env.IS_PRODUCTION && env.REQUIRE_ADMIN_MFA && !env.MFA_ENCRYPTION_KEY) {
  throw new Error(
    "MFA_ENCRYPTION_KEY es obligatoria en production cuando REQUIRE_ADMIN_MFA=true",
  );
}

module.exports = Object.freeze(env);
