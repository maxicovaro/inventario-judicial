const express = require("express");
const router = express.Router();

const { listarRoles } = require("../controllers/roleController");
const {
  verificarToken,
  verificarAdminGeneral,
} = require("../middlewares/authMiddleware");

router.get("/", verificarToken, verificarAdminGeneral, listarRoles);

module.exports = router;
