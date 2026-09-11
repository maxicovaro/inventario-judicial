const env = require("../config/env");
const { setAuthCookie, clearAuthCookie } = require("../utils/authCookie");

const wrapJson = (res, transform) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => originalJson(transform(body, res.statusCode));
};

const loginTransport = (req, res, next) => {
  wrapJson(res, (body, statusCode) => {
    if (
      statusCode >= 200 &&
      statusCode < 300 &&
      body &&
      typeof body === "object" &&
      typeof body.token === "string" &&
      body.token
    ) {
      setAuthCookie(res, body.token);

      if (env.AUTH_TOKEN_TRANSPORT === "cookie") {
        const { token, ...safeBody } = body;
        return safeBody;
      }
    }

    return body;
  });

  next();
};

const logoutTransport = (req, res, next) => {
  wrapJson(res, (body, statusCode) => {
    if (statusCode >= 200 && statusCode < 300) {
      clearAuthCookie(res);
    }
    return body;
  });

  next();
};

module.exports = { loginTransport, logoutTransport };
