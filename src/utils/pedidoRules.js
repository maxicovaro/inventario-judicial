const ESTADOS_VALIDOS = [
  "BORRADOR",
  "ENVIADO",
  "EN_REVISION",
  "APROBADO",
  "ENTREGADO",
  "RECHAZADO",
];

const TRANSICIONES_PERMITIDAS = Object.freeze({
  BORRADOR: ["ENVIADO"],
  ENVIADO: ["EN_REVISION", "APROBADO", "RECHAZADO"],
  EN_REVISION: ["APROBADO", "RECHAZADO"],
  APROBADO: ["ENTREGADO"],
  ENTREGADO: [],
  RECHAZADO: [],
});

const ESTADOS_PROVISIONABLES = [
  "ENVIADO",
  "EN_REVISION",
  "APROBADO",
];

const ESTADOS_PERMITIDOS_DESDE_PROVISION = [
  "EN_REVISION",
  "APROBADO",
  "ENTREGADO",
];

const validarTransicionEstado = (estadoActual, nuevoEstado) => {
  if (
    !ESTADOS_VALIDOS.includes(estadoActual) ||
    !ESTADOS_VALIDOS.includes(nuevoEstado)
  ) {
    return false;
  }

  // Permite operaciones idempotentes.
  if (estadoActual === nuevoEstado) {
    return true;
  }

  return (
    TRANSICIONES_PERMITIDAS[estadoActual]?.includes(nuevoEstado) ||
    false
  );
};

const normalizarEnteroNoNegativo = (valor, nombreCampo) => {
  if (valor === undefined || valor === null || valor === "") {
    return {
      valido: true,
      valor: 0,
    };
  }

  const numero = Number(valor);

  if (!Number.isInteger(numero) || numero < 0) {
    return {
      valido: false,
      mensaje: `${nombreCampo} debe ser un número entero igual o mayor a 0`,
    };
  }

  return {
    valido: true,
    valor: numero,
  };
};

module.exports = {
  ESTADOS_VALIDOS,
  TRANSICIONES_PERMITIDAS,
  ESTADOS_PROVISIONABLES,
  ESTADOS_PERMITIDOS_DESDE_PROVISION,
  validarTransicionEstado,
  normalizarEnteroNoNegativo,
};