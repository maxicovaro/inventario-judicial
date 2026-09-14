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

const exigirStockInicialCero = (req, res, next) => {
  const valor = req.body?.stock_actual;
  if (valor === undefined || valor === null || valor === "") {
    req.body.stock_actual = 0;
    return next();
  }

  const stock = Number(valor);
  if (!Number.isFinite(stock) || stock !== 0) {
    return res.status(400).json({
      mensaje:
        "Los insumos nuevos se crean con stock 0. Registrá luego un INGRESO para que la entrada física quede trazada.",
    });
  }

  req.body.stock_actual = 0;
  return next();
};

router.use(verificarToken, verificarGestionDeposito);

router.get("/contexto", obtenerContexto);

router.get("/activos", listarActivosDeposito);
router.post("/activos", crearActivoDeposito);
router.put("/activos/:id", actualizarActivoDeposito);
router.post("/activos/:id/transferir", transferirActivoDeposito);

router.get("/insumos", listarInsumosDeposito);
router.post("/insumos", exigirStockInicialCero, crearInsumoDeposito);
router.get("/movimientos", listarMovimientosDeposito);
router.post("/movimientos", registrarMovimientoDeposito);
router.post("/stock/asignar", asignarStockDeposito);

router.get("/solicitudes", listarSolicitudesDeposito);
router.put("/solicitudes/:id/responder", responderSolicitudDeposito);

router.get("/pedidos", listarPedidosDeposito);
router.put("/pedidos/:id/proveer", proveerPedidoDeposito);
router.put("/pedidos/:id/estado", actualizarEstadoPedidoDeposito);

module.exports = router;
