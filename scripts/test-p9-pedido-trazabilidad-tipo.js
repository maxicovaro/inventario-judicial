const assert = require("assert");
const app = require("../src/app");
const sequelize = require("../src/config/database");
const {
  Bitacora,
  Insumo,
  MovimientoStock,
  Notificacion,
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

const request = async (
  base,
  path,
  { method = "GET", token, body, idempotencyKey } = {},
) => {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

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

    const informaticaToken = await login(TEST_USERS.responsableInformatica);
    const contableToken = await login(TEST_USERS.responsableContable);
    const contable2Token = await login(TEST_USERS.responsableContable2);

    const pedidoBase = expectStatus(
      await request(base, "/api/pedidos-insumos", {
        method: "POST",
        token: informaticaToken,
        body: {
          mes: 9,
          anio: 2026,
          observaciones: "Pedido mensual base para trazabilidad",
          detalles: [
            {
              insumo_id: fixture.insumoBase.id,
              cantidad_solicitada: 1,
            },
          ],
        },
      }),
      201,
      "Informática crea el pedido mensual base",
    );
    assert.strictEqual(pedidoBase.pedido.tipo, "MENSUAL");

    const pedidoComplementario = expectStatus(
      await request(base, "/api/pedidos-insumos", {
        method: "POST",
        token: informaticaToken,
        body: {
          mes: 9,
          anio: 2026,
          observaciones: "Pedido complementario para validar trazabilidad",
          detalles: [
            {
              insumo_id: fixture.insumoBase.id,
              cantidad_solicitada: 2,
            },
          ],
        },
      }),
      201,
      "Informática crea pedido complementario del mismo período",
    );
    assert.strictEqual(pedidoComplementario.pedido.tipo, "COMPLEMENTARIO");

    const pedidoId = pedidoComplementario.pedido.id;

    expectStatus(
      await request(base, `/api/deposito/pedidos/${pedidoId}/estado`, {
        method: "PUT",
        token: contableToken,
        body: { estado: "APROBADO" },
        idempotencyKey: `p9-traza-complementario-aprobar-${pedidoId}`,
      }),
      200,
      "Contable aprueba el pedido complementario",
    );

    const bitacoraEstado = await Bitacora.findOne({
      where: {
        usuario_id: fixture.users.responsableContable.id,
        accion: "CAMBIAR_ESTADO",
        modulo: "PEDIDOS",
      },
      order: [["id", "DESC"]],
    });
    assert.ok(bitacoraEstado, "La aprobación debe quedar en bitácora");
    assert.match(bitacoraEstado.descripcion, /pedido complementario/i);
    assert.match(bitacoraEstado.descripcion, new RegExp(`N° ${pedidoId}\\b`));
    console.log("OK - aprobación conserva tipo COMPLEMENTARIO en bitácora");

    const pedidosDeposito = expectStatus(
      await request(base, "/api/deposito/pedidos", { token: contable2Token }),
      200,
      "segundo responsable lista pedidos del depósito",
    );
    const visible = pedidosDeposito.find((item) => item.id === pedidoId);
    assert.ok(visible, "El pedido complementario aprobado debe estar visible");
    assert.strictEqual(visible.tipo, "COMPLEMENTARIO");
    const detalle = visible.PedidoInsumoDetalles[0];

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

    expectStatus(
      await request(base, `/api/deposito/pedidos/${pedidoId}/proveer`, {
        method: "PUT",
        token: contable2Token,
        body: {
          estado: "ENTREGADO",
          detalles: [{ id: detalle.id, cantidad_provista: 2 }],
        },
      }),
      200,
      "segundo responsable provisiona el pedido complementario",
    );

    const pedidoDb = await PedidoInsumo.findByPk(pedidoId);
    assert.strictEqual(pedidoDb.estado, "ENTREGADO");
    assert.strictEqual(pedidoDb.tipo, "COMPLEMENTARIO");

    const stockCentralDespues = Number(
      (await Insumo.findByPk(fixture.insumoBase.id)).stock_actual,
    );
    const stockOficinaDespues = Number(
      (
        await StockOficina.findOne({
          where: {
            insumo_id: fixture.insumoBase.id,
            oficina_id: fixture.offices.informatica.id,
          },
        })
      ).cantidad,
    );
    assert.strictEqual(stockCentralDespues, stockCentralAntes - 2);
    assert.strictEqual(stockOficinaDespues, stockOficinaAntes + 2);

    const movimiento = await MovimientoStock.findOne({
      where: {
        insumo_id: fixture.insumoBase.id,
        tipo: "EGRESO",
        oficina_id: fixture.offices.informatica.id,
      },
      order: [["id", "DESC"]],
    });
    assert.ok(movimiento, "La provisión complementaria debe generar EGRESO");
    assert.match(movimiento.motivo, /Entrega por pedido complementario/i);
    assert.match(movimiento.motivo, new RegExp(`N° ${pedidoId}\\b`));
    console.log("OK - MovimientoStock identifica el pedido como complementario");

    const bitacoraProvision = await Bitacora.findOne({
      where: {
        usuario_id: fixture.users.responsableContable2.id,
        accion: "PROVEER",
        modulo: "PEDIDOS",
      },
      order: [["id", "DESC"]],
    });
    assert.ok(bitacoraProvision, "La provisión debe quedar en bitácora");
    assert.match(bitacoraProvision.descripcion, /pedido complementario/i);
    assert.match(bitacoraProvision.descripcion, new RegExp(`N° ${pedidoId}\\b`));
    console.log("OK - provisión conserva tipo COMPLEMENTARIO en bitácora");

    const notificaciones = await Notificacion.findAll({
      where: { usuario_id: fixture.users.responsableInformatica.id },
      order: [["id", "ASC"]],
    });
    const notificacionesPedido = notificaciones.filter((item) =>
      String(item.mensaje || "").includes(`N° ${pedidoId}`),
    );
    assert.ok(
      notificacionesPedido.length >= 2,
      "El solicitante debe recibir notificaciones de aprobación y provisión",
    );
    assert.ok(
      notificacionesPedido.every((item) =>
        /pedido complementario/i.test(`${item.titulo} ${item.mensaje}`),
      ),
      "Las notificaciones del complementario no deben rotularlo como mensual",
    );
    console.log("OK - notificaciones conservan tipo COMPLEMENTARIO");

    console.log(
      "P9.2B - trazabilidad MENSUAL/COMPLEMENTARIO validada correctamente.",
    );
  } finally {
    if (server) await close(server);
    await sequelize.close();
  }
};

main().catch((error) => {
  console.error(`P9.2B trazabilidad de tipo falló: ${error.stack || error.message}`);
  process.exitCode = 1;
});
