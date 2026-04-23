const express = require("express");
const router = express.Router();

const { login, logout } = require("../controllers/authController");
const { verificarToken } = require("../middlewares/authMiddleware");

router.post("/login", login);
router.post("/logout", verificarToken, logout);

module.exports = router;