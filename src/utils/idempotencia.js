const crypto = require("crypto");
const { Op } = require("sequelize");
const { OperacionIdempotente } = require("../models");

const HEADER = "Idempotency-Key";
const KEY_PATTERN = /^[A-Za-z0-9._:-]{8,100}$/;

const ordenarValor = (valor) => {
  if (Array.isArray(valor)) {
    return valor.map(ordenarValor);
  }

  if (valor && typeof valor === "object") {
    return Object.keys(valor)
      .sort()
      .reduce((acumulado, clave) => {
        acumulado[clave] = ordenarValor(valor[clave]);
        return acumulado;
      }, {});
  }

  return valor;
};

const calcularRequestHash = (req, scope) => {
  const payload = {
    scope,
    method: String(req.method || "").toUpperCase(),
    path: String(req.originalUrl || req.url || "").split("?")[0],
    params: ordenarValor(req.params || {}),
    body: ordenarValor(req.body || {}),
  };

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
};

const leerClave = (req) => {
  const raw = req.get?.(HEADER);
  if (raw === undefined || raw === null || raw === "") return null;

  const clave = String(raw).trim();

  if (!KEY_PATTERN.test(clave)) {
    const error = new Error(
      "Idempotency-Key debe tener entre 8 y 100 caracteres y usar solo letras, números, punto, guion, guion bajo o dos puntos",
    );
    error.status = 400;
    throw error;
  }

  return clave;
};

const serializarRespuesta = (body) => JSON.stringify(body ?? null);

const deserializarRespuesta = (texto) => {
  if (texto === null || texto === undefined) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
};

const iniciarTransaccionIdempotente = async ({
  sequelize,
  req,
  scope,
}) => {
  const clave = leerClave(req);
  const requestHash = clave ? calcularRequestHash(req, scope) : null;
  const transaction = await sequelize.transaction();

  if (!clave) {
    return {
      transaction,
      operacion: null,
      replay: null,
    };
  }

  try {
    const operacion = await OperacionIdempotente.create(
      {
        usuario_id: req.usuario.id,
        scope,
        clave,
        request_hash: requestHash,
      },
      { transaction },
    );

    return {
      transaction,
      operacion,
      replay: null,
    };
  } catch (error) {
    const duplicada =
      error.name === "SequelizeUniqueConstraintError" ||
      error.original?.code === "ER_DUP_ENTRY";

    if (!duplicada) {
      await transaction.rollback();
      throw error;
    }

    await transaction.rollback();

    const existente = await OperacionIdempotente.findOne({
      where: {
        usuario_id: req.usuario.id,
        scope,
        clave,
        request_hash: {
          [Op.ne]: null,
        },
      },
    });

    if (!existente) {
      const inconsistencia = new Error(
        "No se pudo resolver la operación idempotente existente",
      );
      inconsistencia.status = 409;
      throw inconsistencia;
    }

    if (existente.request_hash !== requestHash) {
      return {
        transaction: null,
        operacion: null,
        replay: {
          status: 409,
          body: {
            mensaje:
              "La misma Idempotency-Key ya fue usada con una solicitud diferente",
          },
        },
      };
    }

    if (!existente.status_code || existente.response_body === null) {
      return {
        transaction: null,
        operacion: null,
        replay: {
          status: 409,
          body: {
            mensaje: "La operación con esa Idempotency-Key aún está en curso",
          },
        },
      };
    }

    return {
      transaction: null,
      operacion: null,
      replay: {
        status: existente.status_code,
        body: deserializarRespuesta(existente.response_body),
        idempotentReplay: true,
      },
    };
  }
};

const completarIdempotencia = async ({
  operacion,
  transaction,
  status,
  body,
}) => {
  if (!operacion) return;

  await operacion.update(
    {
      status_code: status,
      response_body: serializarRespuesta(body),
    },
    { transaction },
  );
};

const responderReplay = (res, replay) => {
  if (!replay) return false;
  if (replay.idempotentReplay) {
    res.setHeader("Idempotent-Replay", "true");
  }
  res.status(replay.status).json(replay.body);
  return true;
};

module.exports = {
  HEADER,
  calcularRequestHash,
  iniciarTransaccionIdempotente,
  completarIdempotencia,
  responderReplay,
};
