const env = require("../config/env");

const API_CSP =
  "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";
const FRONTEND_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "form-action 'self'",
].join("; ");

const isFrontendRequest = (req) =>
  env.SERVE_FRONTEND_STATIC &&
  !req.path.startsWith("/api/") &&
  !req.path.startsWith("/health/");

const securityHeaders = (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader(
    "Content-Security-Policy",
    isFrontendRequest(req) ? FRONTEND_CSP : API_CSP,
  );

  if (env.IS_PRODUCTION) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
  }

  next();
};

module.exports = { securityHeaders };
