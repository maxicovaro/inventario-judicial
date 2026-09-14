const express = require("express");
const router = express.Router();

const {
  listarOficinas,
  listarOficinasDestinoDeposito,
} = require("../controllers/oficinaController");
const {
  verificarToken,
  verificarGestionDeposito,
} = require("../middlewares/authMiddleware");

router.get(
  "/destinos-deposito",
  verificarToken,
  verificarGestionDeposito,
  listarOficinasDestinoDeposito,
);
router.get("/", verificarToken, listarOficinas);

module.exports = router;
