const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");

const MAGIC = Buffer.from("INVBKP01");
const AAD = Buffer.from("inventario-judicial-p9.5-v1", "utf8");
const EMPTY_SHA256 = crypto.createHash("sha256").update("").digest("hex");

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

const awsEncode = (value) =>
  encodeURIComponent(String(value))
    .replace(/[!'()*]/g, (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    )
    .replace(/%7E/g, "~");

const encodeObjectKey = (key) =>
  String(key)
    .split("/")
    .map((segment) => awsEncode(segment))
    .join("/");

const hmac = (key, value, encoding) =>
  crypto.createHmac("sha256", key).update(value, "utf8").digest(encoding);

const amzTimestamp = (date = new Date()) =>
  date
    .toISOString()
    .replace(/[:-]|\.\d{3}/g, "");

const configFromEnvironment = () => {
  const endpoint = new URL(required("PILOT_BACKUP_S3_ENDPOINT"));
  if (!["https:", "http:"].includes(endpoint.protocol)) {
    throw new Error("PILOT_BACKUP_S3_ENDPOINT debe usar http/https");
  }
  if (endpoint.pathname && endpoint.pathname !== "/") {
    throw new Error(
      "PILOT_BACKUP_S3_ENDPOINT no debe incluir un path; usar sólo el endpoint base",
    );
  }

  return {
    endpoint,
    bucket: required("PILOT_BACKUP_S3_BUCKET"),
    region: required("PILOT_BACKUP_S3_REGION"),
    accessKeyId: required("PILOT_BACKUP_S3_ACCESS_KEY_ID"),
    secretAccessKey: required("PILOT_BACKUP_S3_SECRET_ACCESS_KEY"),
    forcePathStyle: boolEnv("PILOT_BACKUP_S3_FORCE_PATH_STYLE"),
    prefix: String(process.env.PILOT_BACKUP_S3_PREFIX || "p9-5/staging")
      .trim()
      .replace(/^\/+|\/+$/g, ""),
    keep: Number(process.env.PILOT_BACKUP_S3_KEEP || 7),
    encryptionKey: encryptionKeyFromBase64(
      required("PILOT_BACKUP_ENCRYPTION_KEY"),
    ),
  };
};

const s3Configured = () => {
  const names = [
    "PILOT_BACKUP_S3_ENDPOINT",
    "PILOT_BACKUP_S3_BUCKET",
    "PILOT_BACKUP_S3_REGION",
    "PILOT_BACKUP_S3_ACCESS_KEY_ID",
    "PILOT_BACKUP_S3_SECRET_ACCESS_KEY",
    "PILOT_BACKUP_ENCRYPTION_KEY",
  ];
  const present = names.filter(
    (name) => String(process.env[name] || "").trim() !== "",
  );
  if (present.length > 0 && present.length !== names.length) {
    const missing = names.filter((name) => !present.includes(name));
    throw new Error(
      `Configuración S3 P9.5 incompleta; faltan: ${missing.join(", ")}`,
    );
  }
  return present.length === names.length;
};

const signedRequest = ({
  config,
  method,
  key = "",
  query = {},
  body = Buffer.alloc(0),
  contentType = null,
  now = new Date(),
}) => {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const payloadHash = payload.length ? sha256Buffer(payload) : EMPTY_SHA256;
  const timestamp = amzTimestamp(now);
  const dateStamp = timestamp.slice(0, 8);

  const endpointHost = config.endpoint.host;
  const host = config.forcePathStyle
    ? endpointHost
    : `${config.bucket}.${endpointHost}`;

  const encodedKey = key ? encodeObjectKey(key) : "";
  const canonicalUri = config.forcePathStyle
    ? `/${awsEncode(config.bucket)}${encodedKey ? `/${encodedKey}` : "/"}`
    : `/${encodedKey}`;

  const queryPairs = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([name, value]) => [awsEncode(name), awsEncode(value)])
    .sort(([leftName, leftValue], [rightName, rightValue]) =>
      leftName === rightName
        ? leftValue.localeCompare(rightValue)
        : leftName.localeCompare(rightName),
    );
  const canonicalQuery = queryPairs
    .map(([name, value]) => `${name}=${value}`)
    .join("&");

  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${timestamp}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    method,
    canonicalUri || "/",
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    timestamp,
    scope,
    sha256Buffer(Buffer.from(canonicalRequest, "utf8")),
  ].join("\n");

  const dateKey = hmac(
    Buffer.from(`AWS4${config.secretAccessKey}`, "utf8"),
    dateStamp,
  );
  const regionKey = hmac(dateKey, config.region);
  const serviceKey = hmac(regionKey, "s3");
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = hmac(signingKey, stringToSign, "hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const querySuffix = canonicalQuery ? `?${canonicalQuery}` : "";
  const requestPath = `${canonicalUri || "/"}${querySuffix}`;

  const headers = {
    Host: host,
    "X-Amz-Date": timestamp,
    "X-Amz-Content-Sha256": payloadHash,
    Authorization: authorization,
    "Content-Length": String(payload.length),
  };
  if (contentType) headers["Content-Type"] = contentType;

  return {
    protocol: config.endpoint.protocol,
    hostname: host.split(":")[0],
    port: config.endpoint.port || undefined,
    path: requestPath,
    method,
    headers,
    body: payload,
  };
};

const requestBuffer = (options) =>
  new Promise((resolve, reject) => {
    const transport = options.protocol === "http:" ? http : https;
    const request = transport.request(options, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const body = Buffer.concat(chunks);
        if (response.statusCode < 200 || response.statusCode >= 300) {
          const detail = body.toString("utf8").slice(0, 512).trim();
          reject(
            new Error(
              `S3 respondió HTTP ${response.statusCode}${
                detail ? `: ${detail}` : ""
              }`,
            ),
          );
          return;
        }
        resolve({
          statusCode: response.statusCode,
          headers: response.headers,
          body,
        });
      });
    });
    request.on("error", reject);
    if (options.body.length) request.write(options.body);
    request.end();
  });

const s3Request = async (request) =>
  requestBuffer(signedRequest(request));

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

module.exports = {
  configFromEnvironment,
  decryptBuffer,
  encryptBuffer,
  s3Configured,
  signedRequest,
  uploadEncryptedBackup,
};
