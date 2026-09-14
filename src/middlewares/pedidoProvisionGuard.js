const validarEntregaConProvision = (req, res, next) => {
  const { estado, detalles } = req.body || {};

  if (estado !== "ENTREGADO") {
    return next();
  }

  if (!Array.isArray(detalles) || detalles.length === 0) {
    return next();
  }

  const tieneProvisionPositiva = detalles.some((detalle) => {
    const cantidad = Number(detalle?.cantidad_provista);
    return Number.isInteger(cantidad) && cantidad > 0;
  });

  if (!tieneProvisionPositiva) {
    return res.status(400).json({
      mensaje:
        "No se puede marcar el pedido como ENTREGADO sin registrar al menos una unidad provista.",
    });
  }

  return next();
};

module.exports = {
  validarEntregaConProvision,
};
