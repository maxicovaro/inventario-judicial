const logger = require("../utils/logger");

const safeErrorResponses = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    if (res.statusCode >= 500) {
      const internalDetail = body?.error;

      if (internalDetail) {
        logger.error("http_internal_error", {
          request_id: req.requestId,
          method: req.method,
          path: req.path || req.originalUrl?.split("?")[0],
          error: internalDetail,
        });
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
  logger.error("http_unhandled_error", {
    request_id: req.requestId,
    method: req.method,
    path: req.path || req.originalUrl?.split("?")[0],
    error,
  });

  if (res.headersSent) {
    return next(error);
  }

  if (error?.type === "entity.too.large" || error?.status === 413) {
    return res.status(413).json({
      mensaje: "El cuerpo de la solicitud supera el tamaño permitido",
    });
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
