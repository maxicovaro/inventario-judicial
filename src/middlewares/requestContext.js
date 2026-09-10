const crypto = require("crypto");
const logger = require("../utils/logger");

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

const requestContext = (req, res, next) => {
  const incoming = req.get("x-request-id");
  const requestId =
    incoming && REQUEST_ID_PATTERN.test(incoming)
      ? incoming
      : crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    logger.info("http_request_completed", {
      request_id: requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: Number(durationMs.toFixed(2)),
    });
  });

  next();
};

module.exports = { requestContext, REQUEST_ID_PATTERN };
