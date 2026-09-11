const express = require("express");
const router = express.Router();

const { login, me, logout } = require("../controllers/authController");
const {
  status: mfaStatus,
  setup: mfaSetup,
  confirm: mfaConfirm,
  verify: mfaVerify,
  disable: mfaDisable,
} = require("../controllers/mfaController");
const {
  verificarToken,
  verificarSesionMfa,
} = require("../middlewares/authMiddleware");
const { loginRateLimit, mfaRateLimit } = require("../middlewares/rateLimit");
const { loginTransport, logoutTransport } = require("../middlewares/authTransport");

router.post("/login", loginRateLimit, loginTransport, login);
router.get("/me", verificarSesionMfa, me);
router.post("/logout", logoutTransport, verificarSesionMfa, logout);

router.get("/mfa/status", verificarSesionMfa, mfaStatus);
router.post("/mfa/setup", verificarSesionMfa, mfaSetup);
router.post("/mfa/confirm", mfaRateLimit, verificarSesionMfa, mfaConfirm);
router.post("/mfa/verify", mfaRateLimit, verificarSesionMfa, mfaVerify);
router.post(
  "/mfa/disable",
  mfaRateLimit,
  logoutTransport,
  verificarToken,
  mfaDisable,
);

module.exports = router;
