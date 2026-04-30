const express = require("express");
const router = express.Router();

const { obtenerDashboard } = require("../controllers/dashboardController");
const { verificarToken } = require("../middlewares/authMiddleware");

router.get("/", verificarToken, obtenerDashboard);

module.exports = router;