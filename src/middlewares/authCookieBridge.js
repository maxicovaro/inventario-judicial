const { readAuthCookie } = require("../utils/authCookie");

const authCookieBridge = (req, res, next) => {
  if (!req.headers.authorization) {
    const token = readAuthCookie(req);
    if (token) {
      req.headers.authorization = `Bearer ${token}`;
      req.authTransport = "cookie";
    }
  } else {
    req.authTransport = "bearer";
  }

  next();
};

module.exports = { authCookieBridge };
