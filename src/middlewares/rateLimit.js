const env = require("../config/env");

const sharedStore = new Map();

const clientKey = (req) =>
  String(req.ip || req.socket?.remoteAddress || "unknown").trim() || "unknown";

const createFixedWindowRateLimiter = ({
  prefix,
  windowMs,
  max,
  store = sharedStore,
  now = () => Date.now(),
}) => {
  if (!prefix || !Number.isInteger(windowMs) || windowMs <= 0) {
    throw new Error("Configuración inválida de rate limiter");
  }
  if (!Number.isInteger(max) || max <= 0) {
    throw new Error("max debe ser un entero positivo");
  }

  return (req, res, next) => {
    const timestamp = now();
    const key = `${prefix}:${clientKey(req)}`;
    let bucket = store.get(key);

    if (!bucket || timestamp >= bucket.resetAt) {
      bucket = { count: 0, resetAt: timestamp + windowMs };
      store.set(key, bucket);
    }

    bucket.count += 1;

    const remaining = Math.max(0, max - bucket.count);
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((bucket.resetAt - timestamp) / 1000),
    );

    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        mensaje: "Demasiados intentos. Intentá nuevamente más tarde.",
      });
    }

    next();
  };
};

const loginRateLimit = createFixedWindowRateLimiter({
  prefix: "auth-login",
  windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MS,
  max: env.LOGIN_RATE_LIMIT_MAX,
});

module.exports = {
  createFixedWindowRateLimiter,
  loginRateLimit,
};
