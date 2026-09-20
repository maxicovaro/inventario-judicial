const assert = require("assert");
const fs = require("fs");
const {
  isValidBase64Key32,
  validateDeployment,
} = require("./deploy-preflight");
const {
  deploymentExpectation,
  normalizeOrigin,
} = require("./deploy-smoke");

const VALID_MFA_KEY = Buffer.from(
  "0123456789abcdef0123456789abcdef",
  "utf8",
).toString("base64");

const validStagingEnv = () => ({
  DEPLOY_ENV: "staging",
  DEPLOY_REVISION: "0123456789abcdef",
  NODE_ENV: "production",
  CORS_ORIGIN: "https://inventario-staging.example.invalid",
  DB_HOST: "mysql-staging.internal",
  DB_PORT: "3306",
  DB_NAME: "inventario_judicial_staging",
  PRODUCTION_DB_NAME: "inventario_judicial",
  DB_USER: "inventario_staging",
  DB_PASSWORD: "test-only-password",
  JWT_SECRET: "jwt-secret-test-con-mas-de-32-bytes-2026",
  AUTH_TOKEN_TRANSPORT: "cookie",
  TRUST_PROXY_HOPS: "1",
  REQUIRE_ADMIN_MFA: "true",
  MFA_ENCRYPTION_KEY: VALID_MFA_KEY,
  UPLOAD_STORAGE_MODE: "s3",
  UPLOAD_S3_ENDPOINT: "https://storage-staging.example.invalid",
  UPLOAD_S3_BUCKET: "inventario-staging-bucket",
  UPLOAD_S3_REGION: "auto",
  UPLOAD_S3_ACCESS_KEY_ID: "test-access-key",
  UPLOAD_S3_SECRET_ACCESS_KEY: "test-secret-key",
});

const assertRejected = (mutate, expected) => {
  const env = validStagingEnv();
  mutate(env);
  const result = validateDeployment(env);
  assert.strictEqual(result.ok, false);
  assert.match(result.errors.join("\n"), expected);
};

const valid = validateDeployment(validStagingEnv());
assert.strictEqual(valid.ok, true, valid.errors.join("\n"));
assert.strictEqual(valid.summary.deploy_env, "staging");
assert.strictEqual(valid.summary.node_env, "production");

assertRejected((env) => {
  env.NODE_ENV = "development";
}, /NODE_ENV debe ser production/);

assertRejected((env) => {
  env.AUTH_TOKEN_TRANSPORT = "hybrid";
}, /AUTH_TOKEN_TRANSPORT debe ser cookie/);

assertRejected((env) => {
  env.REQUIRE_ADMIN_MFA = "false";
}, /REQUIRE_ADMIN_MFA debe ser true/);

assertRejected((env) => {
  env.CORS_ORIGIN = "http://inventario-staging.example.invalid";
}, /CORS_ORIGIN debe usar https/);

assertRejected((env) => {
  env.TRUST_PROXY_HOPS = "";
}, /TRUST_PROXY_HOPS/);

assertRejected((env) => {
  env.PRODUCTION_DB_NAME = env.DB_NAME;
}, /no puede coincidir/);

assertRejected((env) => {
  env.DEPLOY_REVISION = "";
}, /DEPLOY_REVISION/);

assertRejected((env) => {
  env.UPLOAD_STORAGE_MODE = "local";
}, /UPLOAD_STORAGE_MODE debe ser s3/);

assertRejected((env) => {
  env.UPLOAD_S3_ENDPOINT = "";
}, /UPLOAD_S3_ENDPOINT/);

assert.strictEqual(isValidBase64Key32(VALID_MFA_KEY), true);
assert.strictEqual(isValidBase64Key32("not-a-key"), false);

assert.strictEqual(
  normalizeOrigin("TEST", "https://inventario-staging.example.invalid"),
  "https://inventario-staging.example.invalid",
);
assert.throws(
  () => normalizeOrigin("TEST", "http://inventario-staging.example.invalid"),
  /https/,
);
assert.throws(
  () => normalizeOrigin("TEST", "https://inventario-staging.example.invalid/app"),
  /origen sin ruta/,
);

assert.deepStrictEqual(
  deploymentExpectation({
    DEPLOY_ENV: "staging",
    DEPLOY_REVISION: "0123456789abcdef",
  }),
  {
    environment: "staging",
    revision: "0123456789abcdef",
  },
);
assert.throws(
  () => deploymentExpectation({ DEPLOY_ENV: "development", DEPLOY_REVISION: "abc" }),
  /staging o production/,
);
assert.throws(
  () => deploymentExpectation({ DEPLOY_ENV: "staging", DEPLOY_REVISION: "" }),
  /DEPLOY_REVISION/,
);

const gitignore = fs.readFileSync(".gitignore", "utf8");
const dockerignore = fs.readFileSync(".dockerignore", "utf8");
const stagingExample = fs.readFileSync(".env.staging.example", "utf8");
const frontendStagingExample = fs.readFileSync(
  "inventario-frontend/.env.staging.example",
  "utf8",
);
const backendDockerfile = fs.readFileSync("Dockerfile", "utf8");
const frontendDockerfile = fs.readFileSync(
  "inventario-frontend/Dockerfile",
  "utf8",
);
const caddyfile = fs.readFileSync("inventario-frontend/Caddyfile", "utf8");
const envConfig = fs.readFileSync("src/config/env.js", "utf8");
const uploadStorage = fs.readFileSync("src/utils/uploadStorage.js", "utf8");
const uploadMiddleware = fs.readFileSync(
  "src/middlewares/uploadMiddleware.js",
  "utf8",
);
const adjuntoController = fs.readFileSync(
  "src/controllers/adjuntoController.js",
  "utf8",
);
const operations = fs.readFileSync("docs/OPERATIONS.md", "utf8");
const stagingDoc = fs.readFileSync("docs/STAGING.md", "utf8");
const railwayDoc = fs.readFileSync("docs/RAILWAY_STAGING.md", "utf8");
const migrateScript = fs.readFileSync("scripts/deploy-migrate.js", "utf8");
const smokeScript = fs.readFileSync("scripts/deploy-smoke.js", "utf8");

assert.match(gitignore, /^\.env\.\*$/m);
assert.match(gitignore, /^!\.env\.\*\.example$/m);
assert.match(stagingExample, /NODE_ENV=production/);
assert.match(stagingExample, /DEPLOY_ENV=staging/);
assert.match(stagingExample, /AUTH_TOKEN_TRANSPORT=cookie/);
assert.match(stagingExample, /REQUIRE_ADMIN_MFA=true/);
assert.match(stagingExample, /PRODUCTION_DB_NAME=/);
assert.match(stagingExample, /UPLOAD_STORAGE_MODE=s3/);
assert.match(stagingExample, /UPLOAD_S3_ENDPOINT=/);
assert.match(stagingExample, /UPLOAD_S3_BUCKET=/);
assert.match(frontendStagingExample, /VITE_API_URL=\/api/);

assert.match(backendDockerfile, /FROM node:22-bookworm-slim/);
assert.match(backendDockerfile, /repo\.mysql\.com\/apt\/debian/);
assert.match(backendDockerfile, /mysql-8\.0/);
assert.match(backendDockerfile, /mysql-community-client/);
assert.doesNotMatch(backendDockerfile, /mariadb-client/);
assert.match(backendDockerfile, /CMD \["npm", "start"\]/);
assert.doesNotMatch(backendDockerfile, /db:migrate/);
assert.match(dockerignore, /^storage\/uploads$/m);
assert.match(dockerignore, /^backups$/m);

assert.match(frontendDockerfile, /FROM node:22-alpine AS build/);
assert.match(frontendDockerfile, /ARG VITE_API_URL=\/api/);
assert.match(frontendDockerfile, /FROM caddy:2-alpine/);
assert.match(caddyfile, /handle \/api\/\*/);
assert.match(caddyfile, /handle \/health\/\*/);
assert.match(caddyfile, /BACKEND_INTERNAL_URL/);
assert.match(caddyfile, /handle \/frontend-health/);
assert.match(caddyfile, /try_files \{path\} \/index\.html/);
assert.match(caddyfile, /trusted_proxies static private_ranges 100\.0\.0\.0\/8/);

assert.match(envConfig, /UPLOAD_DIR:/);
assert.match(uploadStorage, /UPLOAD_STORAGE_MODE/);
assert.match(uploadStorage, /UPLOAD_S3_ENDPOINT/);
assert.match(uploadStorage, /UPLOAD_S3_BUCKET/);
assert.match(uploadStorage, /saveUpload/);
assert.match(uploadStorage, /readUpload/);
assert.match(uploadStorage, /deleteUpload/);
assert.match(uploadMiddleware, /multer\.memoryStorage/);
assert.match(adjuntoController, /saveUpload/);
assert.match(adjuntoController, /readUpload/);
assert.match(adjuntoController, /deleteUpload/);

assert.match(migrateScript, /verifyBackupFile/);
assert.match(migrateScript, /backupDatabase !== currentDatabase/);
assert.match(smokeScript, /health\/live/);
assert.match(smokeScript, /health\/ready/);
assert.match(smokeScript, /expectedDeployment/);
assert.match(smokeScript, /access-control-allow-origin/);
assert.match(operations, /STAGING\.md/);
assert.match(stagingDoc, /npm run deploy:preflight/);
assert.match(stagingDoc, /npm run deploy:migrate/);
assert.match(stagingDoc, /npm run deploy:smoke/);
assert.match(railwayDoc, /railway ssh --service backend/);
assert.match(railwayDoc, /Serverless/);
assert.match(railwayDoc, /bucket privado/);
assert.match(railwayDoc, /BACKEND_INTERNAL_URL/);

console.log("✓ Contratos P7.1/P7.2 de staging y Railway validados.");
