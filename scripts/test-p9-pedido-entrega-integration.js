const assert = require("assert");
const app = require("../src/app");
const sequelize = require("../src/config/database");
const {
  Insumo,
  MovimientoStock,
  PedidoInsumo,
  StockOficina,
} = require("../src/models");
const {
  TEST_PASSWORD,
  TEST_USERS,
  resetIntegrationData,
} = require("./integration-fixtures");

const listen = () =>
  new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
    server.once("error", reject);
  });

const close = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

const readBody = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const request = async (base, path, { method = "GET", token, body } = {}) => {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return {
    status: response.status,
    body: await readBody(response),
  };
};

const expectStatus = (result, expected, label) => {
  assert.strictEqual(
    result.status,
    expected,
    `${label}: se esperaba HTTP ${expected}, se obtuvo ${result.status}. Respuesta: ${JSON.stringify(result.body)}`,
  );
  console.log(`OK - ${label}`);
  return result.body;
};

const main = async () => {
  let server;

  try {
    const fixture = await resetIntegrationData();
    server = await listen();
    const base = `http://127.0.0.1:${server.address().port}`;

    const login = async (email) => {
      const body = expectStatus(
        await request(base, "/api/auth/login", {
          method: "POST",
          body: { email, password: TEST_PASSWORD },
        }),
        200,
        `login ${email}`,
      );
      return body.token;
    };

    const contableToken = await login(TEST_USERS.responsableContable);
    const informaticaToken = await login(TEST_USERS.responsableInformatica);

    const pedidoBody = expectStatus(
      await request(base, "/api/pedidos-insumos", {
        method: "POST",
        token: informaticaToken,
        body: {
          mes: 9,
          anio: 2026,
          cantidad_hechos_delictivos: 0,
          cantidad_autopsias: 0,
          observaciones: "Regresión P9.2B entrega cero",
          detalles: [
            {
              insumo_id: fixture.insumoBase.id,
              cantidad_solicitada: 2,
            },
          ],
        },
      }),
      201,
      "Informática crea pedido para regresión de entrega cero",
    );

    const pedidoId = pedidoBody.pedido.id;

    expectStatus(
      await request(base, `/api/deposito/pedidos/${pedidoId}/estado`, {
        method: "PUT",
        token: contableToken,
        body: { estado: "APROBADO" },
      }),
      200,
      "Contable aprueba el pedido",
    );

    const pedidos = expectStatus(
      await request(base, "/api/deposito/pedidos", { token: contableToken }),
      200,
      "Contable obtiene los pedidos del depósito",
    );
    const pedidoVisible = pedidos.find((pedido) => pedido.id === pedidoId);
    assert.ok(pedidoVisible, "El pedido aprobado debe estar visible");
    const detalle = pedidoVisible.PedidoInsumoDetalles?.[0];
    assert.ok(detalle, "El pedido debe conservar su detalle");

    const stockCentralAntes = Number(
      (await Insumo.findByPk(fixture.insumoBase.id)).stock_actual,
    );
    const stockOficinaAntesRegistro = await StockOficina.findOne({
      where: {
        insumo_id: fixture.insumoBase.id,
        oficina_id: fixture.offices.informatica.id,
      },
    });
    const stockOficinaAntes = Number(stockOficinaAntesRegistro?.cantidad || 0);
    const movimientosAntes = await MovimientoStock.count({
      where: {
        insumo_id: fixture.insumoBase.id,
        oficina_id: fixture.offices.informatica.id,
      },
    });

    const entregaCero = expectStatus(
      await request(base, `/api/deposito/pedidos/${pedidoId}/proveer`, {
        method: "PUT",
        token: contableToken,
        body: {
          estado: "ENTREGADO",
          detalles: [{ id: detalle.id, cantidad_provista: 0 }],
        },
      }),
      400,
      "la API bloquea ENTREGADO con provisión cero",
    );
    assert.match(entregaCero.mensaje || "", /al menos una unidad provista/i);

    const pedidoTrasCero = await PedidoInsumo.findByPk(pedidoId);
    const stockCentralTrasCero = Number(
      (await Insumo.findByPk(fixture.insumoBase.id)).stock_actual,
    );
    const stockOficinaTrasCeroRegistro = await StockOficina.findOne({
      where: {
        insumo_id: fixture.insumoBase.id,
        oficina_id: fixture.offices.informatica.id,
      },
    });
    const stockOficinaTrasCero = Number(stockOficinaTrasCeroRegistro?.cantidad || 0);
    const movimientosTrasCero = await MovimientoStock.count({
      where: {
        insumo_id: fixture.insumoBase.id,
        oficina_id: fixture.offices.informatica.id,
      },
    });

    assert.strictEqual(pedidoTrasCero.estado, "APROBADO");
    assert.strictEqual(stockCentralTrasCero, stockCentralAntes);
    assert.strictEqual(stockOficinaTrasCero, stockOficinaAntes);
    assert.strictEqual(movimientosTrasCero, movimientosAntes);
    console.log("OK - el rechazo de entrega cero no modifica estado ni stock");

    expectStatus(
      await request(base, `/api/deposito/pedidos/${pedidoId}/proveer`, {
        method: "PUT",
        token: contableToken,
        body: {
          estado: "ENTREGADO",
          detalles: [{ id: detalle.id, cantidad_provista: 2 }],
        },
      }),
      200,
      "la provisión positiva completa la entrega",
    );

    const pedidoEntregado = await PedidoInsumo.findByPk(pedidoId);
    const stockCentralFinal = Number(
      (await Insumo.findByPk(fixture.insumoBase.id)).stock_actual,
    );
    const stockOficinaFinal = Number(
      (
        await StockOficina.findOne({
          where: {
            insumo_id: fixture.insumoBase.id,
            oficina_id: fixture.offices.informatica.id,
          },
        })
      )?.cantidad || 0,
    );
    const movimientosFinales = await MovimientoStock.count({
      where: {
        insumo_id: fixture.insumoBase.id,
        oficina_id: fixture.offices.informatica.id,
      },
    });

    assert.strictEqual(pedidoEntregado.estado, "ENTREGADO");
    assert.strictEqual(stockCentralFinal, stockCentralAntes - 2);
    assert.strictEqual(stockOficinaFinal, stockOficinaAntes + 2);
    assert.strictEqual(movimientosFinales, movimientosAntes + 1);
    console.log("OK - provisión positiva descuenta exactamente una vez y acredita la oficina");

    console.log("P9.2B - regresión integración entrega cero validada correctamente.");
  } finally {
    if (server) await close(server);
    await sequelize.close();
  }
};

main().catch((error) => {
  console.error(`P9.2B entrega cero integration falló: ${error.stack || error.message}`);
  process.exitCode = 1;
});
