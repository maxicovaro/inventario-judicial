const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { validateDeployment } = require("./deploy-preflight");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts", "staging-free-budget.js");
const current = path.join(root, "pilot", "staging-free-budget.example.json");
const target = path.join(
  root,
  "pilot",
  "staging-free-budget-target.example.json",
);

const run = (args) =>
  spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
  });

const currentRun = run(["--evidence", current]);
if (currentRun.status !== 2) {
  throw new Error(
    `H1 debe demostrar que Railway continuo queda OVER_BUDGET; status=${currentRun.status}: ${currentRun.stderr || currentRun.stdout}`,
  );
}
const currentReport = JSON.parse(currentRun.stdout);
assert.strictEqual(currentReport.status, "OVER_BUDGET");
assert.ok(currentReport.totals.continuous_monthly_usd > 5);

const targetRun = run(["--evidence", target]);
if (targetRun.status !== 0) {
  throw new Error(
    `H1 target residual esperado PASS falló: ${targetRun.stderr || targetRun.stdout}`,
  );
}
const targetReport = JSON.parse(targetRun.stdout);
assert.strictEqual(targetReport.status, "PASS");
assert.ok(targetReport.totals.projected_monthly_usd < 1);
assert.ok(targetReport.totals.projected_headroom_usd > 0.9);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "inventario-h1-"));
try {
  const wrongEnv = JSON.parse(fs.readFileSync(target, "utf8"));
  wrongEnv.environment = "production";
  const wrongEnvFile = path.join(tmp, "production.json");
  fs.writeFileSync(wrongEnvFile, JSON.stringify(wrongEnv), "utf8");

  const rejected = run(["--evidence", wrongEnvFile]);
  if (rejected.status !== 1) {
    throw new Error("H1 debe rechazar evidencia fuera de staging");
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

const requiredFiles = [
  "docs/H1_ZERO_COST_STAGING.md",
  "ROADMAP.md",
  ".github/workflows/quality.yml",
  "package.json",
  "render.yaml",
  "pilot/staging-free-budget-target.example.json",
  "src/utils/s3ObjectClient.js",
  "scripts/staging-external-free-start.js",
];
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    throw new Error(`Falta archivo contractual H1: ${file}`);
  }
}

const render = fs.readFileSync(path.join(root, "render.yaml"), "utf8");
const envConfig = fs.readFileSync(
  path.join(root, "src/config/env.js"),
  "utf8",
);
const database = fs.readFileSync(
  path.join(root, "src/config/database.js"),
  "utf8",
);
const app = fs.readFileSync(path.join(root, "src/app.js"), "utf8");
const headers = fs.readFileSync(
  path.join(root, "src/middlewares/securityHeaders.js"),
  "utf8",
);
const preflight = fs.readFileSync(
  path.join(root, "scripts/deploy-preflight.js"),
  "utf8",
);
const dbCli = fs.readFileSync(
  path.join(root, "scripts/db-cli-utils.js"),
  "utf8",
);

assert.match(render, /plan:\s*free/);
assert.match(render, /autoDeployTrigger:\s*checksPass/);
assert.match(render, /VITE_API_URL=\/api/);
assert.match(render, /SERVE_FRONTEND_STATIC/);
assert.match(render, /STAGING_TOPOLOGY/);
assert.match(render, /DB_SSL/);
assert.match(render, /UPLOAD_STORAGE_MODE/);
assert.match(render, /healthCheckPath:\s*\/health\/ready/);
assert.match(render, /startCommand:\s*npm run staging:external-free:start/);
assert.doesNotMatch(render, /preDeployCommand/);
assert.match(render, /branch:\s*ops\/h1-zero-cost-staging/);

assert.match(envConfig, /DB_SSL_REJECT_UNAUTHORIZED/);
assert.match(envConfig, /SERVE_FRONTEND_STATIC/);
assert.match(envConfig, /RENDER_EXTERNAL_HOSTNAME/);
assert.match(envConfig, /RENDER_GIT_COMMIT/);
assert.match(database, /dialectOptions:\s*\{ ssl \}/);
assert.match(database, /TLSv1\.2/);
assert.match(app, /express\.static/);
assert.match(app, /res\.sendFile\(frontendIndex\)/);
assert.match(headers, /FRONTEND_CSP/);
assert.match(headers, /connect-src 'self'/);
assert.match(preflight, /external-free/);
assert.match(preflight, /DB_SSL debe ser true/);
assert.match(dbCli, /--ssl-mode=VERIFY_IDENTITY/);
assert.match(dbCli, /mysql2SslOptions/);


const renderStagingEnv = {
  NODE_ENV: "production",
  DEPLOY_ENV: "staging",
  STAGING_TOPOLOGY: "external-free",
  RENDER_GIT_COMMIT: "0123456789abcdef",
  RENDER_EXTERNAL_HOSTNAME: "inventario-judicial-staging-free.onrender.com",
  SERVE_FRONTEND_STATIC: "true",
  AUTH_TOKEN_TRANSPORT: "cookie",
  TRUST_PROXY_HOPS: "1",
  REQUIRE_ADMIN_MFA: "true",
  JWT_SECRET: "jwt-h1-test-secret-with-more-than-32-bytes",
  MFA_ENCRYPTION_KEY: Buffer.from(
    "0123456789abcdef0123456789abcdef",
    "utf8",
  ).toString("base64"),
  DB_HOST: "gateway01.us-west-2.prod.aws.tidbcloud.com",
  DB_PORT: "4000",
  DB_NAME: "inventario_judicial_staging",
  DB_USER: "h1-test-user",
  DB_PASSWORD: "h1-test-password",
  DB_SSL: "true",
  DB_SSL_REJECT_UNAUTHORIZED: "true",
  DB_SSL_CA_PATH: "/etc/ssl/certs/ca-certificates.crt",
  PRODUCTION_DB_NAME: "inventario_judicial",
  UPLOAD_STORAGE_MODE: "s3",
  UPLOAD_S3_ENDPOINT: "https://storage.example.invalid",
  UPLOAD_S3_BUCKET: "inventario-staging",
  UPLOAD_S3_REGION: "auto",
  UPLOAD_S3_ACCESS_KEY_ID: "test-access",
  UPLOAD_S3_SECRET_ACCESS_KEY: "test-secret",
};

const validRender = validateDeployment(renderStagingEnv);
assert.strictEqual(validRender.ok, true, validRender.errors.join("\n"));
assert.strictEqual(
  validRender.summary.revision,
  renderStagingEnv.RENDER_GIT_COMMIT,
);
assert.strictEqual(validRender.summary.staging_topology, "external-free");
assert.strictEqual(validRender.summary.db_ssl, true);
assert.strictEqual(validRender.summary.serve_frontend_static, true);

const insecureRender = {
  ...renderStagingEnv,
  DB_SSL: "false",
};
const insecureResult = validateDeployment(insecureRender);
assert.strictEqual(insecureResult.ok, false);
assert.match(insecureResult.errors.join("\n"), /DB_SSL debe ser true/);

console.log("✓ Contratos H1 de staging gratuito verificados.");
