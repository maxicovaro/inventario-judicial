const assert = require("assert");
const {
  safeErrorResponses,
  globalErrorHandler,
} = require("../src/middlewares/safeErrorResponses");

const crearRespuesta = () => {
  const res = {
    statusCode: 200,
    headersSent: false,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  return res;
};

const req = { method: "GET", originalUrl: "/api/prueba" };

{
  const res = crearRespuesta();
  const originalError = console.error;
  console.error = () => {};
  safeErrorResponses(req, res, () => {});
  res.status(500).json({ mensaje: "Falló consulta", error: "SQL interno secreto" });
  console.error = originalError;

  assert.deepStrictEqual(res.body, { mensaje: "Falló consulta" });
}

{
  const res = crearRespuesta();
  safeErrorResponses(req, res, () => {});
  res.status(409).json({ mensaje: "Conflicto de negocio", error: "detalle permitido" });

  assert.deepStrictEqual(res.body, {
    mensaje: "Conflicto de negocio",
    error: "detalle permitido",
  });
}

{
  const res = crearRespuesta();
  const originalError = console.error;
  console.error = () => {};
  safeErrorResponses(req, res, () => {});
  globalErrorHandler(new Error("detalle interno"), req, res, () => {});
  console.error = originalError;

  assert.strictEqual(res.statusCode, 500);
  assert.deepStrictEqual(res.body, { mensaje: "Error interno del servidor" });
}

{
  const res = crearRespuesta();
  const originalError = console.error;
  console.error = () => {};
  safeErrorResponses(req, res, () => {});
  globalErrorHandler(new Error("Tipo de archivo no permitido"), req, res, () => {});
  console.error = originalError;

  assert.strictEqual(res.statusCode, 400);
  assert.deepStrictEqual(res.body, { mensaje: "Tipo de archivo no permitido" });
}

{
  const res = crearRespuesta();
  const multerError = new Error("File too large");
  multerError.name = "MulterError";
  multerError.code = "LIMIT_FILE_SIZE";
  const originalError = console.error;
  console.error = () => {};
  safeErrorResponses(req, res, () => {});
  globalErrorHandler(multerError, req, res, () => {});
  console.error = originalError;

  assert.strictEqual(res.statusCode, 400);
  assert.deepStrictEqual(res.body, {
    mensaje: "El archivo supera el tamaño máximo permitido de 10 MB",
  });
}

console.log("Manejo seguro de errores validado correctamente.");