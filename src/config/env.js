require("dotenv").config();

const NODE_ENV = process.env.NODE_ENV || "development";
const entornosPermitidos = new Set(["development", "test", "production"]);

if (!entornosPermitidos.has(NODE_ENV)) {
  throw new Error(
    `NODE_ENV inválido: ${NODE_ENV}. Usá development, test o production`,
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

module.exports = Object.freeze(env);
