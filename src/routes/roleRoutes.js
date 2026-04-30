const express = require("express");
const router = express.Router();

const { listarRoles } = require("../controllers/roleController");
const { verificarToken, verificarRol } = require("../middlewares/authMiddleware");

router.get("/", verificarToken, verificarRol("ADMIN"), listarRoles);

module.exports = router;