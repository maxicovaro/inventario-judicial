const crypto = require("crypto");
const http = require("http");
const https = require("https");

const EMPTY_SHA256 = crypto.createHash("sha256").update("").digest("hex");

const sha256Buffer = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

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

const normalizeConfig = (input) => {
  const endpoint =
    input.endpoint instanceof URL ? input.endpoint : new URL(String(input.endpoint || ""));
  if (!["https:", "http:"].includes(endpoint.protocol)) {
    throw new Error("El endpoint S3 debe usar http/https");
  }
  if (endpoint.pathname && endpoint.pathname !== "/") {
    throw new Error("El endpoint S3 no debe incluir path");
  }

  const required = [
    ["bucket", input.bucket],
    ["region", input.region],
    ["accessKeyId", input.accessKeyId],
    ["secretAccessKey", input.secretAccessKey],
  ];
  for (const [label, value] of required) {
    if (!String(value || "").trim()) {
      throw new Error(`Falta configuración S3 requerida: ${label}`);
    }
  }

  return {
    endpoint,
    bucket: String(input.bucket).trim(),
    region: String(input.region).trim(),
    accessKeyId: String(input.accessKeyId).trim(),
    secretAccessKey: String(input.secretAccessKey).trim(),
    forcePathStyle: Boolean(input.forcePathStyle),
  };
};

const signedRequest = ({
  config: rawConfig,
  method,
  key = "",
  query = {},
  body = Buffer.alloc(0),
  contentType = null,
  now = new Date(),
}) => {
  const config = normalizeConfig(rawConfig);
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
          const error = new Error(
            `S3 respondió HTTP ${response.statusCode}${
              detail ? `: ${detail}` : ""
            }`,
          );
          error.statusCode = response.statusCode;
          reject(error);
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

const putObject = async (config, key, body, contentType = "application/octet-stream") =>
  s3Request({
    config,
    method: "PUT",
    key,
    body,
    contentType,
  });

const getObject = async (config, key) =>
  s3Request({
    config,
    method: "GET",
    key,
  });

const deleteObject = async (config, key) =>
  s3Request({
    config,
    method: "DELETE",
    key,
  });

const listObjects = async (config, prefix = "") =>
  s3Request({
    config,
    method: "GET",
    query: {
      "list-type": "2",
      prefix,
    },
  });

module.exports = {
  deleteObject,
  getObject,
  listObjects,
  normalizeConfig,
  putObject,
  requestBuffer,
  s3Request,
  signedRequest,
};
