const env = require("../config/env");
const { JWT_TTL_SECONDS } = require("../config/jwt");

const AUTH_COOKIE_NAME = env.IS_PRODUCTION
  ? "__Host-inventario_session"
  : "inventario_session";

const parseCookies = (header = "") => {
  const result = {};

  for (const segment of String(header).split(";")) {
    const separator = segment.indexOf("=");
    if (separator <= 0) continue;

    const name = segment.slice(0, separator).trim();
    const value = segment.slice(separator + 1).trim();
    if (!name) continue;

    try {
      result[name] = decodeURIComponent(value);
    } catch {
      result[name] = value;
    }
  }

  return result;
};

const buildAuthCookie = (token) => {
  const attributes = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Strict",
    `Max-Age=${JWT_TTL_SECONDS}`,
  ];

  if (env.IS_PRODUCTION) attributes.push("Secure");
  return attributes.join("; ");
};

const buildClearAuthCookie = () => {
  const attributes = [
    `${AUTH_COOKIE_NAME}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Strict",
    "Max-Age=0",
  ];

  if (env.IS_PRODUCTION) attributes.push("Secure");
  return attributes.join("; ");
};

const setAuthCookie = (res, token) => {
  res.append("Set-Cookie", buildAuthCookie(token));
};

const clearAuthCookie = (res) => {
  res.append("Set-Cookie", buildClearAuthCookie());
};

const readAuthCookie = (req) => {
  const cookies = parseCookies(req.headers?.cookie || "");
  return cookies[AUTH_COOKIE_NAME] || null;
};

module.exports = {
  AUTH_COOKIE_NAME,
  parseCookies,
  buildAuthCookie,
  buildClearAuthCookie,
  setAuthCookie,
  clearAuthCookie,
  readAuthCookie,
};
