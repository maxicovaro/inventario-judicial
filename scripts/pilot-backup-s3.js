const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  s3Request,
  signedRequest,
} = require("../src/utils/s3ObjectClient");

const MAGIC = Buffer.from("INVBKP01");
const AAD = Buffer.from("inventario-judicial-p9.5-v1", "utf8");

const required = (name) => {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Falta la variable requerida: ${name}`);
  return value;
};

const boolEnv = (name) =>
  ["1", "true", "yes"].includes(
    String(process.env[name] || "").trim().toLowerCase(),
  );

const sha256Buffer = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

const encryptionKeyFromBase64 = (value) => {
  const key = Buffer.from(String(value || "").trim(), "base64");
  if (key.length !== 32) {
    throw new Error(
      "PILOT_BACKUP_ENCRYPTION_KEY debe contener exactamente 32 bytes codificados en Base64",
    );
  }
  return key;
};

const encryptBuffer = (plaintext, key) => {
  if (!Buffer.isBuffer(plaintext)) {
    throw new TypeError("encryptBuffer requiere un Buffer");
  }
  if (!Buffer.isBuffer(key) || key.length !== 32) {
    throw new Error("La clave AES-256-GCM debe tener 32 bytes");
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(AAD);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([MAGIC, iv, tag, ciphertext]);
};

const decryptBuffer = (payload, key) => {
  if (!Buffer.isBuffer(payload) || payload.length < MAGIC.length + 12 + 16) {
    throw new Error("La copia cifrada es inválida o está truncada");
  }
  if (!payload.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("La copia cifrada no tiene el formato P9.5 esperado");
  }
  if (!Buffer.isBuffer(key) || key.length !== 32) {
    throw new Error("La clave AES-256-GCM debe tener 32 bytes");
  }

  const ivStart = MAGIC.length;
  const tagStart = ivStart + 12;
  const cipherStart = tagStart + 16;
  const iv = payload.subarray(ivStart, tagStart);
  const tag = payload.subarray(tagStart, cipherStart);
  const ciphertext = payload.subarray(cipherStart);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(AAD);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
};

const xmlDecode = (value) =>
  String(value)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

const listObjects = async (config) => {
  const response = await s3Request({
    config,
    method: "GET",
    query: {
      "list-type": "2",
      prefix: config.prefix ? `${config.prefix}/` : "",
    },
  });
  const xml = response.body.toString("utf8");
  const objects = [];

  for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
    const block = match[1];
    const key = block.match(/<Key>([\s\S]*?)<\/Key>/)?.[1];
    const lastModified = block.match(
      /<LastModified>([\s\S]*?)<\/LastModified>/,
    )?.[1];
    if (!key) continue;
    objects.push({
      key: xmlDecode(key),
      lastModified: lastModified ? new Date(lastModified) : null,
    });
  }

  return objects;
};

const deleteObject = async (config, key) => {
  await s3Request({
    config,
    method: "DELETE",
    key,
  });
};

const pruneEncryptedBackups = async (config) => {
  const keep = Number(config.keep);
  if (!Number.isInteger(keep) || keep < 1 || keep > 365) {
    throw new Error("PILOT_BACKUP_S3_KEEP debe ser un entero entre 1 y 365");
  }

  const objects = await listObjects(config);
  const backups = objects
    .filter((item) => item.key.endsWith(".sql.enc"))
    .sort((left, right) => {
      const leftTime = left.lastModified?.getTime() || 0;
      const rightTime = right.lastModified?.getTime() || 0;
      return rightTime - leftTime;
    });

  const deleted = [];
  for (const item of backups.slice(keep)) {
    const metadataKey = item.key.replace(/\.sql\.enc$/, ".meta.json");
    await deleteObject(config, item.key);
    const metadataExists = objects.some(
      (candidate) => candidate.key === metadataKey,
    );
    if (metadataExists) await deleteObject(config, metadataKey);
    deleted.push(path.posix.basename(item.key));
  }
  return deleted;
};

const uploadEncryptedBackup = async (verified) => {
  const config = configFromEnvironment();
  const plaintext = fs.readFileSync(verified.backupPath);
  const plaintextSha256 = sha256Buffer(plaintext);

  if (
    plaintextSha256 !== verified.sha256 ||
    plaintext.length !== verified.bytes
  ) {
    throw new Error(
      "El backup cambió antes de preparar la copia cifrada secundaria",
    );
  }

  const encrypted = encryptBuffer(plaintext, config.encryptionKey);
  const baseName = path.basename(verified.backupPath, ".sql");
  const prefix = config.prefix ? `${config.prefix}/` : "";
  const encryptedKey = `${prefix}${baseName}.sql.enc`;
  const metadataKey = `${prefix}${baseName}.meta.json`;
  const latestKey = `${prefix}latest.json`;

  const metadata = {
    schema_version: 1,
    encryption: "AES-256-GCM",
    backup_file: path.basename(verified.backupPath),
    backup_created_at: verified.metadata.created_at,
    database: verified.metadata.database,
    dump_tool: verified.metadata.dump_tool || null,
    source_snapshot: verified.metadata.source_snapshot || null,
    plaintext_bytes: verified.bytes,
    plaintext_sha256: verified.sha256,
    encrypted_bytes: encrypted.length,
    uploaded_at: new Date().toISOString(),
  };
  const metadataBuffer = Buffer.from(
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );

  await s3Request({
    config,
    method: "PUT",
    key: encryptedKey,
    body: encrypted,
    contentType: "application/octet-stream",
  });
  await s3Request({
    config,
    method: "PUT",
    key: metadataKey,
    body: metadataBuffer,
    contentType: "application/json",
  });

  const downloaded = await s3Request({
    config,
    method: "GET",
    key: encryptedKey,
  });
  const recovered = decryptBuffer(downloaded.body, config.encryptionKey);
  const recoveredSha256 = sha256Buffer(recovered);

  if (
    recoveredSha256 !== verified.sha256 ||
    recovered.length !== verified.bytes
  ) {
    throw new Error(
      "La copia cifrada S3 no recupera exactamente el backup de origen",
    );
  }

  const latest = Buffer.from(
    `${JSON.stringify(
      {
        schema_version: 1,
        object_key: encryptedKey,
        metadata_key: metadataKey,
        backup_file: path.basename(verified.backupPath),
        backup_created_at: verified.metadata.created_at,
        plaintext_bytes: verified.bytes,
        plaintext_sha256: verified.sha256,
        encryption: "AES-256-GCM",
        verified_at: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  await s3Request({
    config,
    method: "PUT",
    key: latestKey,
    body: latest,
    contentType: "application/json",
  });

  const deleted = await pruneEncryptedBackups(config);

  return {
    enabled: true,
    verified: true,
    encrypted: true,
    provider: "s3-compatible",
    object_key: encryptedKey,
    metadata_key: metadataKey,
    plaintext_bytes: verified.bytes,
    plaintext_sha256: verified.sha256,
    encrypted_bytes: encrypted.length,
    retention: {
      keep: config.keep,
      deleted,
    },
  };
};

const downloadLatestEncryptedBackup = async (options = {}) => {
  const config = configFromEnvironment();
  const prefixValue = config.prefix ? `${config.prefix}/` : "";
  const latestKey = `${prefixValue}latest.json`;

  const latestResponse = await s3Request({
    config,
    method: "GET",
    key: latestKey,
  });
  const latest = JSON.parse(latestResponse.body.toString("utf8"));

  if (!latest.object_key || !latest.metadata_key) {
    throw new Error("El índice latest del bucket no contiene objetos verificables");
  }

  const metadataResponse = await s3Request({
    config,
    method: "GET",
    key: latest.metadata_key,
  });
  const metadata = JSON.parse(metadataResponse.body.toString("utf8"));

  if (
    !metadata.database ||
    !metadata.backup_created_at ||
    !metadata.source_snapshot ||
    !metadata.plaintext_sha256 ||
    !Number(metadata.plaintext_bytes)
  ) {
    throw new Error(
      "La metadata cifrada del bucket no contiene snapshot/checksum suficientes para restore",
    );
  }

  const encryptedResponse = await s3Request({
    config,
    method: "GET",
    key: latest.object_key,
  });
  const recovered = decryptBuffer(
    encryptedResponse.body,
    config.encryptionKey,
  );
  const recoveredSha256 = sha256Buffer(recovered);

  if (
    recoveredSha256 !== metadata.plaintext_sha256 ||
    recovered.length !== Number(metadata.plaintext_bytes)
  ) {
    throw new Error(
      "El backup recuperado desde bucket no coincide con su metadata",
    );
  }

  const outputDirectory = path.resolve(
    options.outputDirectory || "pilot-backup-results/recovered",
  );
  fs.mkdirSync(outputDirectory, { recursive: true });

  const backupName = path.basename(
    metadata.backup_file || "inventario-recovered.sql",
  );
  const backupPath = path.join(outputDirectory, backupName);
  const checksumMetadata = {
    format: "mysql-sql",
    database: metadata.database,
    created_at: metadata.backup_created_at,
    bytes: Number(metadata.plaintext_bytes),
    sha256: metadata.plaintext_sha256,
    dump_tool: metadata.dump_tool || "recovered-from-s3",
    source_snapshot: metadata.source_snapshot,
  };

  fs.writeFileSync(backupPath, recovered);
  fs.writeFileSync(
    `${backupPath}.sha256.json`,
    `${JSON.stringify(checksumMetadata, null, 2)}\n`,
    "utf8",
  );

  return {
    backupPath,
    metadata: checksumMetadata,
    latest,
    bucketMetadata: metadata,
    outputDirectory,
  };
};

module.exports = {
  configFromEnvironment,
  decryptBuffer,
  downloadLatestEncryptedBackup,
  encryptBuffer,
  s3Configured,
  signedRequest,
  uploadEncryptedBackup,
};
