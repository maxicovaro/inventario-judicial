const safeErrorResponses = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    if (res.statusCode >= 500) {
      const internalDetail = body?.error;

      if (internalDetail) {
        console.error(
          `[HTTP ${res.statusCode}] ${req.method} ${req.originalUrl}`,
          internalDetail,
        );
      }

      return originalJson({
        mensaje: body?.mensaje || "Error interno del servidor",
      });
    }

    return originalJson(body);
  };

  next();
};

const globalErrorHandler = (error, req, res, next) => {
  console.error(
    `[UNHANDLED] ${req.method} ${req.originalUrl}`,
    error,
  );

  if (res.headersSent) {
    return next(error);
  }

  if (error?.message === "Tipo de archivo no permitido") {
    return res.status(400).json({
      mensaje: "Tipo de archivo no permitido",
    });
  }

  if (error?.name === "MulterError") {
    const mensaje =
      error.code === "LIMIT_FILE_SIZE"
        ? "El archivo supera el tamaño máximo permitido de 10 MB"
        : "Error en la carga del archivo";

    return res.status(400).json({ mensaje });
  }

  return res.status(500).json({
    mensaje: "Error interno del servidor",
  });
};

module.exports = {
  safeErrorResponses,
  globalErrorHandler,
};