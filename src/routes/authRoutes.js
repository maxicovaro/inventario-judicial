const express = require("express");
const router = express.Router();

const { login, logout } = require("../controllers/authController");
const { verificarToken } = require("../middlewares/authMiddleware");
const { loginRateLimit } = require("../middlewares/rateLimit");
const { loginTransport, logoutTransport } = require("../middlewares/authTransport");

router.post("/login", loginRateLimit, loginTransport, login);
router.post("/logout", logoutTransport, verificarToken, logout);

module.exports = router;
