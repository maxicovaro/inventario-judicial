const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const env = require("../config/env");
const {
  deleteObject,
  getObject,
  putObject,
} = require("./s3ObjectClient");

const mode = String(process.env.UPLOAD_STORAGE_MODE || "local")
  .trim()
  .toLowerCase();

if (!["local", "s3"].includes(mode)) {
  throw new Error("UPLOAD_STORAGE_MODE debe ser local o s3");
}

const uploadsDir = env.UPLOAD_DIR
  ? path.resolve(env.UPLOAD_DIR)
  : path.join(__dirname, "../../storage/uploads");

const cleanPrefix = (value) =>
  String(value || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");

const required = (name) => {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(
      `${name} es obligatoria cuando UPLOAD_STORAGE_MODE=s3`,
    );
  }
  return value;
};

const s3Config = () => ({
  endpoint: required("UPLOAD_S3_ENDPOINT"),
  bucket: required("UPLOAD_S3_BUCKET"),
  region: required("UPLOAD_S3_REGION"),
  accessKeyId: required("UPLOAD_S3_ACCESS_KEY_ID"),
  secretAccessKey: required("UPLOAD_S3_SECRET_ACCESS_KEY"),
  forcePathStyle: ["1", "true", "yes"].includes(
    String(process.env.UPLOAD_S3_FORCE_PATH_STYLE || "")
      .trim()
      .toLowerCase(),
  ),
});

const prefix = () =>
  cleanPrefix(process.env.UPLOAD_S3_PREFIX || "uploads/staging");

const safeFilename = (filename) => {
  const value = String(filename || "").trim();
  if (!value || path.basename(value) !== value || /[\\/]/.test(value)) {
    throw new Error("Nombre de archivo almacenado inválido");
  }
  return value;
};

const objectKey = (filename) => {
  const safe = safeFilename(filename);
  const root = prefix();
  return root ? `${root}/${safe}` : safe;
};

const ensureUploadsDir = () => {
  if (mode !== "local") return null;
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  return uploadsDir;
};

const resolveUploadPath = (filename) =>
  path.join(uploadsDir, safeFilename(filename));

const createStoredFilename = (originalName, forcedExtension = null) => {
  const extension =
    forcedExtension === null
      ? path.extname(String(originalName || ""))
      : forcedExtension;
  const base = path
    .basename(String(originalName || "archivo"), path.extname(String(originalName || "")))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .slice(0, 80) || "archivo";

  return `${Date.now()}-${crypto.randomUUID()}-${base}${extension}`;
};

const saveUpload = async (filename, body, contentType) => {
  const safe = safeFilename(filename);
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);

  if (mode === "local") {
    ensureUploadsDir();
    await fs.promises.writeFile(resolveUploadPath(safe), buffer);
    return {
      backend: "local",
      key: safe,
      bytes: buffer.length,
    };
  }

  await putObject(
    s3Config(),
    objectKey(safe),
    buffer,
    contentType || "application/octet-stream",
  );
  return {
    backend: "s3",
    key: safe,
    bytes: buffer.length,
  };
};

const readUpload = async (filename) => {
  const safe = safeFilename(filename);

  if (mode === "local") {
    try {
      return await fs.promises.readFile(resolveUploadPath(safe));
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }

  try {
    const response = await getObject(s3Config(), objectKey(safe));
    return response.body;
  } catch (error) {
    if (error.statusCode === 404) return null;
    throw error;
  }
};

const deleteUpload = async (filename) => {
  const safe = safeFilename(filename);

  if (mode === "local") {
    await fs.promises.rm(resolveUploadPath(safe), { force: true });
    return;
  }

  await deleteObject(s3Config(), objectKey(safe));
};

module.exports = {
  createStoredFilename,
  deleteUpload,
  ensureUploadsDir,
  mode,
  objectKey,
  readUpload,
  resolveUploadPath,
  saveUpload,
  uploadsDir,
};
