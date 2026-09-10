const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

require("dotenv").config();

const required = (name, fallback) => {
  const value = process.env[name] ?? fallback;
  if (value === undefined || String(value).trim() === "") {
    throw new Error(`Falta la variable requerida: ${name}`);
  }
  return String(value).trim();
};

const databaseConfig = (prefix = "DB", fallback = {}) => ({
  host: required(`${prefix}_HOST`, fallback.host),
  port: Number(required(`${prefix}_PORT`, fallback.port || 3306)),
  name: required(`${prefix}_NAME`, fallback.name),
  user: required(`${prefix}_USER`, fallback.user),
  password: required(`${prefix}_PASSWORD`, fallback.password),
});

const validateDatabaseName = (name) => {
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error("El nombre de base solo puede contener letras, números y guion bajo");
  }
  return name;
};

const mysqlEnvironment = (password) => ({
  ...process.env,
  MYSQL_PWD: password,
});

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    windowsHide: true,
    encoding: options.encoding === undefined ? "utf8" : options.encoding,
    ...options,
  });

  if (result.error) {
    throw new Error(`No se pudo ejecutar ${command}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const stderr = String(result.stderr || "").trim();
    throw new Error(`${command} finalizó con código ${result.status}${stderr ? `: ${stderr}` : ""}`);
  }

  return result;
};

const sha256File = (filePath) => {
  const hash = crypto.createHash("sha256");
  const fd = fs.openSync(filePath, "r");
  const buffer = Buffer.alloc(1024 * 1024);

  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(fd);
  }

  return hash.digest("hex");
};

const metadataPathFor = (backupPath) => `${backupPath}.sha256.json`;

const verifyBackupFile = (backupPath) => {
  const absolute = path.resolve(backupPath);
  const metadataPath = metadataPathFor(absolute);

  if (!fs.existsSync(absolute)) throw new Error(`No existe el backup: ${absolute}`);
  if (!fs.existsSync(metadataPath)) {
    throw new Error(`Falta el archivo de checksum: ${metadataPath}`);
  }

  const stats = fs.statSync(absolute);
  if (!stats.isFile() || stats.size < 128) {
    throw new Error("El backup está vacío o es demasiado pequeño para ser válido");
  }

  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  const actualHash = sha256File(absolute);

  if (metadata.sha256 !== actualHash) {
    throw new Error("El checksum SHA-256 del backup no coincide");
  }

  if (Number(metadata.bytes) !== stats.size) {
    throw new Error("El tamaño del backup no coincide con su metadata");
  }

  return {
    backupPath: absolute,
    metadataPath,
    metadata,
    bytes: stats.size,
    sha256: actualHash,
  };
};

module.exports = {
  databaseConfig,
  metadataPathFor,
  mysqlEnvironment,
  run,
  sha256File,
  validateDatabaseName,
  verifyBackupFile,
};
