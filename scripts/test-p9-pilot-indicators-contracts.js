const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const assertIncludes = (source, fragments, label) => {
  for (const fragment of fragments) {
    if (!source.includes(fragment)) {
      throw new Error(`Contrato P9.4 incumplido en ${label}: falta ${fragment}`);
    }
  }
};

const snapshot = read("scripts/pilot-metrics-snapshot.js");
const idempotency = read("src/utils/idempotencia.js");
const packageJson = JSON.parse(read("package.json"));

assertIncludes(
  snapshot,
  [
    '["staging", "test"].includes(env.DEPLOY_ENV)',
    "information_schema.tables",
    "bitacora",
    "pedidos_insumos",
    "solicitudes",
    "movimientos_stock",
    "operaciones_idempotentes",
    "auth_events",
    "admin_mfa",
    "attachments_created_in_window",
    "Railway HTTP/runtime logs",
    "Railway service metrics",
    "P9.1 incident records",
  ],
  "scripts/pilot-metrics-snapshot.js",
);

if (/INSERT\s|UPDATE\s|DELETE\s|TRUNCATE\s|ALTER\s|DROP\s|CREATE\s+TABLE\s/i.test(snapshot)) {
  throw new Error("El snapshot P9.4 debe permanecer estrictamente read-only");
}

assertIncludes(
  idempotency,
  [
    'logger.warn("idempotency_conflict"',
    'logger.warn("idempotency_in_progress"',
    'logger.info("idempotency_replay"',
    'Idempotent-Replay',
  ],
  "src/utils/idempotencia.js",
);

if (
  packageJson.scripts?.["pilot:metrics:snapshot"] !==
  "node scripts/pilot-metrics-snapshot.js"
) {
  throw new Error("package.json debe exponer pilot:metrics:snapshot");
}

if (
  packageJson.scripts?.["test:p9-pilot-indicators-contracts"] !==
  "node scripts/test-p9-pilot-indicators-contracts.js"
) {
  throw new Error("package.json debe exponer test:p9-pilot-indicators-contracts");
}

if (
  !String(packageJson.scripts?.test || "").includes(
    "test:p9-pilot-indicators-contracts",
  )
) {
  throw new Error("npm test debe ejecutar test:p9-pilot-indicators-contracts");
}

console.log("✓ Contratos P9.4 de indicadores del piloto verificados.");
