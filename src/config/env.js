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

module.exports = Object.freeze(env);
