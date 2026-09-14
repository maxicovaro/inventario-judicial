const assert = require("assert");
const fs = require("fs");

const {
  ESTADOS_PROVISIONABLES,
  ESTADOS_PERMITIDOS_DESDE_PROVISION,
  validarTransicionEstado,
  normalizarEnteroNoNegativo,
} = require("../src/utils/pedidoRules");

let pruebas = 0;

const probar = (descripcion, fn) => {
  fn();
  pruebas += 1;
  console.log(`OK ${pruebas}: ${descripcion}`);
};

// --------------------------------------------------
// TRANSICIONES VÁLIDAS
// --------------------------------------------------

probar("BORRADOR -> ENVIADO", () => {
  assert.strictEqual(
    validarTransicionEstado("BORRADOR", "ENVIADO"),
    true
  );
});

probar("ENVIADO -> EN_REVISION", () => {
  assert.strictEqual(
    validarTransicionEstado("ENVIADO", "EN_REVISION"),
    true
  );
});

probar("ENVIADO -> APROBADO", () => {
  assert.strictEqual(
    validarTransicionEstado("ENVIADO", "APROBADO"),
    true
  );
});

probar("EN_REVISION -> APROBADO", () => {
  assert.strictEqual(
    validarTransicionEstado("EN_REVISION", "APROBADO"),
    true
  );
});

probar("APROBADO -> ENTREGADO", () => {
  assert.strictEqual(
    validarTransicionEstado("APROBADO", "ENTREGADO"),
    true
  );
});

probar("estado idempotente permitido", () => {
  assert.strictEqual(
    validarTransicionEstado("EN_REVISION", "EN_REVISION"),
    true
  );
});

// --------------------------------------------------
// TRANSICIONES INVÁLIDAS
// --------------------------------------------------

probar("ENVIADO no puede ir directo a ENTREGADO", () => {
  assert.strictEqual(
    validarTransicionEstado("ENVIADO", "ENTREGADO"),
    false
  );
});

probar("ENTREGADO es terminal", () => {
  assert.strictEqual(
    validarTransicionEstado("ENTREGADO", "EN_REVISION"),
    false
  );
});

probar("RECHAZADO es terminal", () => {
  assert.strictEqual(
    validarTransicionEstado("RECHAZADO", "APROBADO"),
    false
  );
});

probar("APROBADO no puede volver a BORRADOR", () => {
  assert.strictEqual(
    validarTransicionEstado("APROBADO", "BORRADOR"),
    false
  );
});

// --------------------------------------------------
// PROVISIÓN
// --------------------------------------------------

probar("solo APROBADO puede mover stock por provisión", () => {
  assert.deepStrictEqual(
    ESTADOS_PROVISIONABLES,
    ["APROBADO"]
  );
});

probar("ENVIADO todavía no puede mover stock", () => {
  assert.strictEqual(
    ESTADOS_PROVISIONABLES.includes("ENVIADO"),
    false
  );
});

probar("EN_REVISION todavía no puede mover stock", () => {
  assert.strictEqual(
    ESTADOS_PROVISIONABLES.includes("EN_REVISION"),
    false
  );
});

probar("ENTREGADO no es estado modificable", () => {
  assert.strictEqual(
    ESTADOS_PROVISIONABLES.includes("ENTREGADO"),
    false
  );
});

probar("RECHAZADO no es estado modificable", () => {
  assert.strictEqual(
    ESTADOS_PROVISIONABLES.includes("RECHAZADO"),
    false
  );
});

probar("ENTREGADO puede ser resultado de provisión", () => {
  assert.strictEqual(
    ESTADOS_PERMITIDOS_DESDE_PROVISION.includes("ENTREGADO"),
    true
  );
});

probar("APROBADO puede conservarse durante provisión parcial", () => {
  assert.strictEqual(
    ESTADOS_PERMITIDOS_DESDE_PROVISION.includes("APROBADO"),
    true
  );
});

probar("EN_REVISION no puede establecerse desde provisión", () => {
  assert.strictEqual(
    ESTADOS_PERMITIDOS_DESDE_PROVISION.includes("EN_REVISION"),
    false
  );
});

probar("RECHAZADO no puede producirse desde provisión", () => {
  assert.strictEqual(
    ESTADOS_PERMITIDOS_DESDE_PROVISION.includes("RECHAZADO"),
    false
  );
});

// --------------------------------------------------
// ENTEROS NO NEGATIVOS
// --------------------------------------------------

probar("valor vacío se normaliza a cero", () => {
  assert.deepStrictEqual(
    normalizarEnteroNoNegativo(
      "",
      "Campo"
    ),
    {
      valido: true,
      valor: 0,
    }
  );
});

probar("entero positivo válido", () => {
  assert.deepStrictEqual(
    normalizarEnteroNoNegativo(
      12,
      "Campo"
    ),
    {
      valido: true,
      valor: 12,
    }
  );
});

probar("valor negativo inválido", () => {
  assert.strictEqual(
    normalizarEnteroNoNegativo(
      -1,
      "Campo"
    ).valido,
    false
  );
});

probar("decimal inválido", () => {
  assert.strictEqual(
    normalizarEnteroNoNegativo(
      1.5,
      "Campo"
    ).valido,
    false
  );
});

probar("texto inválido", () => {
  assert.strictEqual(
    normalizarEnteroNoNegativo(
      "abc",
      "Campo"
    ).valido,
    false
  );
});

// --------------------------------------------------
// COMPROBACIONES DE CONTROLADORES
// --------------------------------------------------

const createController = fs.readFileSync(
  "src/controllers/pedidoCreateController.js",
  "utf8"
);

const controller = fs.readFileSync(
  "src/controllers/pedidoInsumoController.js",
  "utf8"
);

probar("pedido nuevo fuerza cantidad_provista = 0", () => {
  assert.match(
    createController,
    /cantidad_provista:\s*0/
  );
});

probar("pedido nuevo registra fecha_envio", () => {
  assert.match(
    createController,
    /fecha_envio:\s*new Date\(\)/
  );
});

probar("controlador valida transición de estados", () => {
  assert.match(
    controller,
    /validarTransicionEstado/
  );
});

probar("controlador exige estado provisionable", () => {
  assert.match(
    controller,
    /ESTADOS_PROVISIONABLES\.includes\(pedido\.estado\)/
  );
});

probar("ENTREGADO exige provisión", () => {
  assert.match(
    controller,
    /ENTREGADO debe registrarse mediante la provisión/
  );
});

probar("concurrencia del mensual devuelve conflicto reintentable", () => {
  assert.match(
    createController,
    /status\(409\)/
  );
  assert.match(
    createController,
    /Volvé a enviar para registrarlo como complementario/
  );
});

// --------------------------------------------------
// PEDIDOS COMPLEMENTARIOS P9.2B
// --------------------------------------------------

const pedidoModel = fs.readFileSync(
  "src/models/PedidoInsumo.js",
  "utf8"
);
const migration = fs.readFileSync(
  "src/db/migrations/20260914_007_pedidos_complementarios.js",
  "utf8"
);
const pedidoFrontend = fs.readFileSync(
  "inventario-frontend/src/pages/PedidoMensual.jsx",
  "utf8"
);
const pedidoRoutes = fs.readFileSync(
  "src/routes/pedidoInsumoRoutes.js",
  "utf8"
);

probar("primer pedido del periodo se conserva como MENSUAL", () => {
  assert.match(createController, /tipoPedido === "MENSUAL" \? 1 : null/);
});

probar("pedido posterior del periodo se clasifica COMPLEMENTARIO", () => {
  assert.match(createController, /\? "COMPLEMENTARIO"\s*:\s*"MENSUAL"/);
});

probar("complementarios usan clave mensual NULL", () => {
  assert.match(pedidoModel, /clave_mensual_unica/);
  assert.match(migration, /tipo = 'COMPLEMENTARIO'/);
  assert.match(migration, /clave_mensual_unica = NULL/);
});

probar("se reemplaza la unicidad antigua por la unicidad del pedido base", () => {
  assert.match(migration, /uq_pedido_oficina_mes_anio/);
  assert.match(migration, /uq_pedido_mensual_oficina_mes_anio/);
  assert.match(pedidoModel, /"oficina_id", "mes", "anio", "clave_mensual_unica"/);
});

probar("ruta POST usa el creador compatible con complementarios", () => {
  assert.match(pedidoRoutes, /pedidoCreateController/);
});

probar("frontend explica y muestra resultado de pedido complementario", () => {
  assert.match(pedidoFrontend, /pedido complementario/);
  assert.match(pedidoFrontend, /response\.data\?\.mensaje/);
});

console.log(
  `\n${pruebas} pruebas de reglas de pedidos superadas correctamente.`
);
