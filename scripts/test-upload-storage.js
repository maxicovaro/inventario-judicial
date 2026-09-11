const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const middleware = fs.readFileSync("src/middlewares/uploadMiddleware.js", "utf8");
const controller = fs.readFileSync("src/controllers/adjuntoController.js", "utf8");

assert.match(middleware, /require\("\.\.\/utils\/uploadStorage"\)/);
assert.match(controller, /require\("\.\.\/utils\/uploadStorage"\)/);
assert.doesNotMatch(controller, /\.\.\/\.\.\/storage\/uploads/);
assert.match(controller, /resolveUploadPath\(req\.file\.filename\)/);
assert.match(controller, /resolveUploadPath\(adjunto\.ruta_archivo\)/);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "inventario-upload-storage-"));
const requestedDir = path.join(tempRoot, "persistent", "uploads");
const probe = `
  const path = require("path");
  const storage = require("./src/utils/uploadStorage");
  const expected = path.resolve(process.env.UPLOAD_DIR);
  if (storage.uploadsDir !== expected) {
    throw new Error("UPLOAD_DIR no fue respetado");
  }
  storage.ensureUploadsDir();
  if (!require("fs").existsSync(expected)) {
    throw new Error("No se creó la carpeta persistente");
  }
  const resolved = storage.resolveUploadPath("archivo.pdf");
  if (resolved !== path.join(expected, "archivo.pdf")) {
    throw new Error("resolveUploadPath usa otra carpeta");
  }
  console.log("OK");
`;

try {
  const result = spawnSync(process.execPath, ["-e", probe], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      UPLOAD_DIR: requestedDir,
    },
    encoding: "utf8",
  });

  assert.strictEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /OK/);
  console.log("✓ UPLOAD_DIR es compartido por carga, compresión, descarga y borrado.");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
