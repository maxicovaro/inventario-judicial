const env = require("../config/env");
const { readAuthCookie } = require("../utils/authCookie");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const trustedOrigin = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  const cookieToken = readAuthCookie(req);
  if (!cookieToken) return next();

  const origin = String(req.headers.origin || "").trim();
  if (origin !== env.CORS_ORIGIN) {
    return res.status(403).json({
      mensaje: "Origen no autorizado para una operación autenticada",
    });
  }

  next();
};

module.exports = { trustedOrigin };
