const express = require("express");
const router = express.Router();

const { listarRoles } = require("../controllers/roleController");
const { verificarToken } = require("../middlewares/authMiddleware");

router.get("/", verificarToken, listarRoles);

module.exports = router;