const express = require("express");
const router = express.Router();
const {
  verificarToken,
  verificarGestionDeposito,
} = require("../middlewares/authMiddleware");
const {
  obtenerContexto,
  listarActivosDeposito,
  crearActivoDeposito,
  actualizarActivoDeposito,
  transferirActivoDeposito,
  listarInsumosDeposito,
  crearInsumoDeposito,
  listarMovimientosDeposito,
  registrarMovimientoDeposito,
  asignarStockDeposito,
  listarSolicitudesDeposito,
  responderSolicitudDeposito,
  listarPedidosDeposito,
  proveerPedidoDeposito,
  actualizarEstadoPedidoDeposito,
} = require("../controllers/depositoController");

router.use(verificarToken, verificarGestionDeposito);

router.get("/contexto", obtenerContexto);

router.get("/activos", listarActivosDeposito);
router.post("/activos", crearActivoDeposito);
router.put("/activos/:id", actualizarActivoDeposito);
router.post("/activos/:id/transferir", transferirActivoDeposito);

router.get("/insumos", listarInsumosDeposito);
router.post("/insumos", crearInsumoDeposito);
router.get("/movimientos", listarMovimientosDeposito);
router.post("/movimientos", registrarMovimientoDeposito);
router.post("/stock/asignar", asignarStockDeposito);

router.get("/solicitudes", listarSolicitudesDeposito);
router.put("/solicitudes/:id/responder", responderSolicitudDeposito);

router.get("/pedidos", listarPedidosDeposito);
router.put("/pedidos/:id/proveer", proveerPedidoDeposito);
router.put("/pedidos/:id/estado", actualizarEstadoPedidoDeposito);

module.exports = router;
