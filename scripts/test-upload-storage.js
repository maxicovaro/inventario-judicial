const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { signedRequest } = require("../src/utils/s3ObjectClient");

const middleware = fs.readFileSync("src/middlewares/uploadMiddleware.js", "utf8");
const controller = fs.readFileSync("src/controllers/adjuntoController.js", "utf8");
const storageSource = fs.readFileSync("src/utils/uploadStorage.js", "utf8");

assert.match(middleware, /multer\.memoryStorage\(\)/);
assert.doesNotMatch(middleware, /diskStorage/);
assert.match(controller, /saveUpload\(/);
assert.match(controller, /readUpload\(/);
assert.match(controller, /deleteUpload\(/);
assert.doesNotMatch(controller, /fs\.existsSync|res\.download/);
assert.match(storageSource, /UPLOAD_STORAGE_MODE/);
assert.match(storageSource, /UPLOAD_S3_ENDPOINT/);
assert.match(storageSource, /UPLOAD_S3_BUCKET/);
assert.match(storageSource, /UPLOAD_S3_ACCESS_KEY_ID/);
assert.match(storageSource, /UPLOAD_S3_SECRET_ACCESS_KEY/);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "inventario-upload-storage-"));
const requestedDir = path.join(tempRoot, "persistent", "uploads");
const probe = [
  "(async () => {",
  "  const storage = require(\"./src/utils/uploadStorage\");",
  "  if (storage.mode !== \"local\") throw new Error(\"Modo local inesperado\");",
  "  const expected = require(\"path\").resolve(process.env.UPLOAD_DIR);",
  "  if (storage.uploadsDir !== expected) throw new Error(\"UPLOAD_DIR no fue respetado\");",
  "  const name = storage.createStoredFilename(\"Prueba Documento.pdf\");",
  "  await storage.saveUpload(name, Buffer.from(\"contenido\"), \"application/pdf\");",
  "  const recovered = await storage.readUpload(name);",
  "  if (!recovered || recovered.toString(\"utf8\") !== \"contenido\") throw new Error(\"Lectura local no coincide\");",
  "  await storage.deleteUpload(name);",
  "  if (await storage.readUpload(name)) throw new Error(\"El borrado local no eliminó el objeto\");",
  "  console.log(\"OK\");",
  "})().catch((error) => { console.error(error); process.exit(1); });",
].join("\n");

try {
  const result = spawnSync(process.execPath, ["-e", probe], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "test",
      DB_HOST: process.env.DB_HOST || "127.0.0.1",
      DB_PORT: process.env.DB_PORT || "3306",
      DB_NAME: process.env.DB_NAME || "inventario_test",
      DB_USER: process.env.DB_USER || "inventario_test",
      DB_PASSWORD: process.env.DB_PASSWORD || "inventario_test",
      JWT_SECRET: process.env.JWT_SECRET || "test_secret_long_enough_for_inventario_2026",
      UPLOAD_STORAGE_MODE: "local",
      UPLOAD_DIR: requestedDir,
    },
    encoding: "utf8",
  });

  assert.strictEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /OK/);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

const signed = signedRequest({
  config: {
    endpoint: "https://example.invalid",
    bucket: "bucket-test",
    region: "auto",
    accessKeyId: "test-access-key",
    secretAccessKey: "test-secret-key",
    forcePathStyle: false,
  },
  method: "PUT",
  key: "uploads/staging/example.pdf",
  body: Buffer.from("contenido"),
  contentType: "application/pdf",
  now: new Date("2026-09-20T12:00:00.000Z"),
});

assert.strictEqual(signed.hostname, "bucket-test.example.invalid");
assert.strictEqual(signed.method, "PUT");
assert.strictEqual(signed.path, "/uploads/staging/example.pdf");
assert.match(signed.headers.Authorization, /^AWS4-HMAC-SHA256 Credential=/);
assert.strictEqual(signed.headers["Content-Type"], "application/pdf");

console.log("✓ Adjuntos usan memoria + storage abstracto; local y firma S3 cubiertos.");
