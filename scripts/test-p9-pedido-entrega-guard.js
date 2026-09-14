const assert = require("assert");
const {
  validarEntregaConProvision,
} = require("../src/middlewares/pedidoProvisionGuard");

const ejecutar = ({ body }) => {
  let nextLlamado = false;
  let statusCode = null;
  let payload = null;

  const req = { body };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      payload = data;
      return this;
    },
  };
  const next = () => {
    nextLlamado = true;
  };

  validarEntregaConProvision(req, res, next);
  return { nextLlamado, statusCode, payload };
};

const entregaCero = ejecutar({
  body: {
    estado: "ENTREGADO",
    detalles: [{ id: 1, cantidad_provista: 0 }],
  },
});
assert.strictEqual(entregaCero.nextLlamado, false);
assert.strictEqual(entregaCero.statusCode, 400);
assert.match(entregaCero.payload?.mensaje || "", /al menos una unidad provista/i);
console.log("OK - no se permite ENTREGADO con provisión total 0");

const entregaVacia = ejecutar({
  body: {
    estado: "ENTREGADO",
    detalles: [
      { id: 1, cantidad_provista: "0" },
      { id: 2, cantidad_provista: 0 },
    ],
  },
});
assert.strictEqual(entregaVacia.nextLlamado, false);
assert.strictEqual(entregaVacia.statusCode, 400);
console.log("OK - múltiples detalles en cero también quedan bloqueados");

const entregaPositiva = ejecutar({
  body: {
    estado: "ENTREGADO",
    detalles: [
      { id: 1, cantidad_provista: 0 },
      { id: 2, cantidad_provista: 2 },
    ],
  },
});
assert.strictEqual(entregaPositiva.nextLlamado, true);
assert.strictEqual(entregaPositiva.statusCode, null);
console.log("OK - una provisión positiva continúa hacia el controlador transaccional");

const provisionSinEntrega = ejecutar({
  body: {
    estado: "APROBADO",
    detalles: [{ id: 1, cantidad_provista: 0 }],
  },
});
assert.strictEqual(provisionSinEntrega.nextLlamado, true);
assert.strictEqual(provisionSinEntrega.statusCode, null);
console.log("OK - la guardia no altera operaciones que no cierran el pedido como ENTREGADO");

console.log("P9.2B - guardia contra entrega con provisión cero validada correctamente.");
