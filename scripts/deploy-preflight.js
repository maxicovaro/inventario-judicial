const { URL } = require("url");

require("dotenv").config();

const DEPLOY_ENVIRONMENTS = new Set(["staging", "production"]);

const text = (value) => String(value ?? "").trim();

const parseBoolean = (value) => {
  const normalized = text(value).toLowerCase();
  if (["true", "1", "yes", "si"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  return null;
};

const parseNonNegativeInteger = (value) => {
  if (!/^\d+$/.test(text(value))) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const parseHttpsOrigin = (name, value, errors) => {
  const raw = text(value);
  if (!raw) {
    errors.push(`Falta ${name}`);
    return null;
  }

  try {
    const url = new URL(raw);
    const isOriginOnly =
      url.pathname === "/" && !url.search && !url.hash && url.username === "" && url.password === "";

    if (url.protocol !== "https:") {
      errors.push(`${name} debe usar https://`);
    }
    if (!isOriginOnly) {
      errors.push(`${name} debe ser un origen sin ruta, query ni fragmento`);
    }

    return url.origin;
  } catch {
    errors.push(`${name} debe ser una URL absoluta válida`);
    return null;
  }
};

const isValidBase64Key32 = (value) => {
  const raw = text(value);
  if (!raw || !/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) return false;
  try {
    return Buffer.from(raw, "base64").length === 32;
  } catch {
    return false;
  }
};

const validateDeployment = (input = process.env) => {
  const errors = [];
  const deployEnv = text(input.DEPLOY_ENV).toLowerCase();

  if (!DEPLOY_ENVIRONMENTS.has(deployEnv)) {
    errors.push("DEPLOY_ENV debe ser staging o production para un despliegue controlado");
  }

  if (text(input.NODE_ENV).toLowerCase() !== "production") {
    errors.push("NODE_ENV debe ser production en staging y production");
  }

  if (!text(input.DEPLOY_REVISION)) {
    errors.push("Falta DEPLOY_REVISION con el commit o versión a desplegar");
  }

  if (text(input.AUTH_TOKEN_TRANSPORT).toLowerCase() !== "cookie") {
    errors.push("AUTH_TOKEN_TRANSPORT debe ser cookie");
  }

  if (parseBoolean(input.REQUIRE_ADMIN_MFA) !== true) {
    errors.push("REQUIRE_ADMIN_MFA debe ser true");
  }

  if (Buffer.byteLength(text(input.JWT_SECRET), "utf8") < 32) {
    errors.push("JWT_SECRET debe tener al menos 32 bytes");
  }

  if (!isValidBase64Key32(input.MFA_ENCRYPTION_KEY)) {
    errors.push("MFA_ENCRYPTION_KEY debe ser Base64 de exactamente 32 bytes");
  }

  parseHttpsOrigin("CORS_ORIGIN", input.CORS_ORIGIN, errors);

  const trustProxyHops = parseNonNegativeInteger(input.TRUST_PROXY_HOPS);
  if (trustProxyHops === null) {
    errors.push("TRUST_PROXY_HOPS debe definirse explícitamente como entero >= 0");
  }

  const requiredDb = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"];
  for (const name of requiredDb) {
    if (!text(input[name])) errors.push(`Falta ${name}`);
  }

  const dbPort = parseNonNegativeInteger(input.DB_PORT);
  if (text(input.DB_PORT) && (!dbPort || dbPort > 65535)) {
    errors.push("DB_PORT debe ser un puerto válido entre 1 y 65535");
  }

  if (deployEnv === "staging") {
    const productionDbName = text(input.PRODUCTION_DB_NAME);
    if (!productionDbName) {
      errors.push("PRODUCTION_DB_NAME es obligatorio en staging como guarda de separación");
    } else if (text(input.DB_NAME) === productionDbName) {
      errors.push("DB_NAME de staging no puede coincidir con PRODUCTION_DB_NAME");
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      deploy_env: deployEnv || null,
      node_env: text(input.NODE_ENV) || null,
      revision: text(input.DEPLOY_REVISION) || null,
      auth_transport: text(input.AUTH_TOKEN_TRANSPORT) || null,
      admin_mfa: parseBoolean(input.REQUIRE_ADMIN_MFA),
      trust_proxy_hops: trustProxyHops,
      db_name: text(input.DB_NAME) || null,
    },
  };
};

const main = () => {
  const result = validateDeployment(process.env);

  if (!result.ok) {
    console.error("✗ Preflight de despliegue rechazado:");
    for (const error of result.errors) console.error(`  - ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log("✓ Preflight de despliegue aprobado.");
  console.log(`  Entorno: ${result.summary.deploy_env}`);
  console.log(`  Revisión: ${result.summary.revision}`);
  console.log(`  Base: ${result.summary.db_name}`);
  console.log(`  trust proxy hops: ${result.summary.trust_proxy_hops}`);
};

if (require.main === module) main();

module.exports = {
  isValidBase64Key32,
  parseHttpsOrigin,
  validateDeployment,
};
