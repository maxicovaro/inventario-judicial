const assert = require("assert");
const app = require("../src/app");
const sequelize = require("../src/config/database");
const {
  Activo,
  Movimiento,
  Insumo,
  StockOficina,
  Solicitud,
  PedidoInsumo,
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
    headers: response.headers,
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
    const address = server.address();
    const base = `http://127.0.0.1:${address.port}`;

    const login = async (email) => {
      const result = await request(base, "/api/auth/login", {
        method: "POST",
        body: { email, password: TEST_PASSWORD },
      });
      const body = expectStatus(result, 200, `login ${email}`);
      return body.token;
    };

    const contableToken = await login(TEST_USERS.responsableContable);
    const informaticaToken = await login(TEST_USERS.responsableInformatica);

    const contableMe = expectStatus(
      await request(base, "/api/auth/me", { token: contableToken }),
      200,
      "RESPONSABLE de Contable obtiene sesión",
    );
    const informaticaMe = expectStatus(
      await request(base, "/api/auth/me", { token: informaticaToken }),
      200,
      "RESPONSABLE de Informática obtiene sesión",
    );

    assert.strictEqual(contableMe.usuario.role, "RESPONSABLE");
    assert.strictEqual(contableMe.usuario.oficina_gestiona_deposito, true);
    assert.strictEqual(informaticaMe.usuario.oficina_gestiona_deposito, false);
    console.log("OK - capacidad de depósito proviene de la oficina y no del rol global");

    const contexto = expectStatus(
      await request(base, "/api/deposito/contexto", { token: contableToken }),
      200,
      "Contable accede al contexto de Depósito Central",
    );
    assert.strictEqual(contexto.deposito.id, fixture.offices.deposito.id);
    assert.strictEqual(contexto.oficina_gestora.id, fixture.offices.contable.id);

    expectStatus(
      await request(base, "/api/deposito/contexto", { token: informaticaToken }),
      403,
      "Informática no administra Depósito Central",
    );

    expectStatus(
      await request(base, "/api/usuarios", { token: contableToken }),
      403,
      "Contable no hereda administración global de usuarios",
    );

    const activoContableBody = expectStatus(
      await request(base, "/api/activos", {
        method: "POST",
        token: contableToken,
        body: {
          codigo_interno: "P9-CONTABLE-001",
          nombre: "PC propia de Contable",
          categoria_id: fixture.categoria.id,
          oficina_id: fixture.offices.informatica.id,
          cantidad: 1,
          estado: "Buen estado",
        },
        idempotencyKey: "p9-contable-own-asset-001",
      }),
      201,
      "Contable registra activo propio mediante flujo normal de oficina",
    );
    const activoContable = await Activo.findByPk(activoContableBody.activo.id);
    assert.strictEqual(activoContable.oficina_id, fixture.offices.contable.id);
    console.log("OK - un activo propio de Contable no se mezcla con Depósito Central");

    const activoDepositoBody = expectStatus(
      await request(base, "/api/deposito/activos", {
        method: "POST",
        token: contableToken,
        body: {
          codigo_interno: "P9-DEP-001",
          nombre: "Notebook pendiente de distribución",
          categoria_id: fixture.categoria.id,
          cantidad: 1,
          estado: "Buen estado",
        },
        idempotencyKey: "p9-deposito-asset-create-001",
      }),
      201,
      "Contable ingresa activo al Depósito Central",
    );

    let activoDeposito = await Activo.findByPk(activoDepositoBody.activo.id);
    assert.strictEqual(activoDeposito.oficina_id, fixture.offices.deposito.id);

    expectStatus(
      await request(base, "/api/deposito/activos", {
        method: "POST",
        token: informaticaToken,
        body: {
          nombre: "Activo no autorizado",
          categoria_id: fixture.categoria.id,
        },
      }),
      403,
      "Informática no puede ingresar activos al depósito",
    );

    expectStatus(
      await request(base, `/api/deposito/activos/${activoDeposito.id}/transferir`, {
        method: "POST",
        token: contableToken,
        body: { oficina_destino_id: fixture.offices.informatica.id },
        idempotencyKey: "p9-deposito-transfer-asset-001",
      }),
      200,
      "Contable entrega activo de depósito a Informática",
    );

    activoDeposito = await Activo.findByPk(activoDeposito.id);
    assert.strictEqual(activoDeposito.oficina_id, fixture.offices.informatica.id);
    const traslado = await Movimiento.findOne({
      where: { activo_id: activoDeposito.id, tipo: "TRASLADO" },
    });
    assert.ok(traslado, "La entrega debe generar movimiento TRASLADO");
    assert.match(traslado.descripcion, /Depósito/i);
    assert.match(traslado.descripcion, /Informática/i);
    console.log("OK - entrega patrimonial conserva trazabilidad de origen y destino");

    const insumoAntes = await Insumo.findByPk(fixture.insumoBase.id);
    const stockCentralAntes = Number(insumoAntes.stock_actual);

    expectStatus(
      await request(base, "/api/deposito/stock/asignar", {
        method: "POST",
        token: contableToken,
        body: {
          insumo_id: fixture.insumoBase.id,
          oficina_id: fixture.offices.informatica.id,
          cantidad: 10,
          motivo: "Entrega piloto a Informática",
        },
        idempotencyKey: "p9-deposito-stock-informatica-001",
      }),
      200,
      "Contable distribuye insumos a Informática",
    );

    const insumoDespues = await Insumo.findByPk(fixture.insumoBase.id);
    const stockInformatica = await StockOficina.findOne({
      where: {
        insumo_id: fixture.insumoBase.id,
        oficina_id: fixture.offices.informatica.id,
      },
    });
    assert.strictEqual(Number(insumoDespues.stock_actual), stockCentralAntes - 10);
    assert.strictEqual(Number(stockInformatica.cantidad), 10);
    console.log("OK - distribución descuenta central y acredita oficina en forma consistente");

    expectStatus(
      await request(base, "/api/deposito/stock/asignar", {
        method: "POST",
        token: informaticaToken,
        body: {
          insumo_id: fixture.insumoBase.id,
          oficina_id: fixture.offices.contable.id,
          cantidad: 1,
        },
      }),
      403,
      "Informática no puede distribuir stock central",
    );

    const solicitudBody = expectStatus(
      await request(base, "/api/solicitudes", {
        method: "POST",
        token: informaticaToken,
        body: {
          tipo: "ADQUISICION",
          descripcion: "Solicitud piloto desde Informática",
          prioridad: "ALTA",
        },
      }),
      201,
      "Informática crea una solicitud institucional",
    );

    const solicitudesDeposito = expectStatus(
      await request(base, "/api/deposito/solicitudes", { token: contableToken }),
      200,
      "Contable visualiza solicitudes institucionales desde depósito",
    );
    assert.ok(
      solicitudesDeposito.some((item) => item.id === solicitudBody.solicitud.id),
      "La solicitud de Informática debe aparecer en la bandeja del depósito",
    );

    expectStatus(
      await request(
        base,
        `/api/deposito/solicitudes/${solicitudBody.solicitud.id}/responder`,
        {
          method: "PUT",
          token: contableToken,
          body: {
            estado: "APROBADA",
            respuesta_admin: "Aprobada para gestión del Depósito Central",
          },
        },
      ),
      200,
      "Contable responde solicitud institucional",
    );
    const solicitudDb = await Solicitud.findByPk(solicitudBody.solicitud.id);
    assert.strictEqual(solicitudDb.estado, "APROBADA");

    const pedidoBody = expectStatus(
      await request(base, "/api/pedidos-insumos", {
        method: "POST",
        token: informaticaToken,
        body: {
          mes: 9,
          anio: 2026,
          cantidad_hechos_delictivos: 0,
          cantidad_autopsias: 0,
          observaciones: "Pedido piloto de Informática",
          detalles: [
            {
              insumo_id: fixture.insumoBase.id,
              cantidad_solicitada: 5,
            },
          ],
        },
      }),
      201,
      "Informática envía pedido mensual",
    );

    const pedidoId = pedidoBody.pedido.id;
    expectStatus(
      await request(base, `/api/deposito/pedidos/${pedidoId}/estado`, {
        method: "PUT",
        token: contableToken,
        body: { estado: "APROBADO" },
        idempotencyKey: "p9-deposito-pedido-aprobar-001",
      }),
      200,
      "Contable aprueba pedido mensual",
    );

    const pedidosDeposito = expectStatus(
      await request(base, "/api/deposito/pedidos", { token: contableToken }),
      200,
      "Contable visualiza pedidos institucionales",
    );
    const pedidoVisible = pedidosDeposito.find((item) => item.id === pedidoId);
    assert.ok(pedidoVisible, "El pedido aprobado debe estar visible en depósito");
    const detalle = pedidoVisible.PedidoInsumoDetalles[0];

    const stockAntesProvision = Number((await Insumo.findByPk(fixture.insumoBase.id)).stock_actual);
    const stockOficinaAntesProvision = Number(
      (
        await StockOficina.findOne({
          where: {
            insumo_id: fixture.insumoBase.id,
            oficina_id: fixture.offices.informatica.id,
          },
        })
      ).cantidad,
    );

    expectStatus(
      await request(base, `/api/deposito/pedidos/${pedidoId}/proveer`, {
        method: "PUT",
        token: contableToken,
        body: {
          estado: "ENTREGADO",
          detalles: [{ id: detalle.id, cantidad_provista: 5 }],
        },
      }),
      200,
      "Contable provisiona y entrega pedido mensual",
    );

    const pedidoDb = await PedidoInsumo.findByPk(pedidoId);
    const stockTrasProvision = Number(
      (await Insumo.findByPk(fixture.insumoBase.id)).stock_actual,
    );
    const stockOficinaTrasProvision = Number(
      (
        await StockOficina.findOne({
          where: {
            insumo_id: fixture.insumoBase.id,
            oficina_id: fixture.offices.informatica.id,
          },
        })
      ).cantidad,
    );
    assert.strictEqual(pedidoDb.estado, "ENTREGADO");
    assert.strictEqual(stockTrasProvision, stockAntesProvision - 5);
    assert.strictEqual(stockOficinaTrasProvision, stockOficinaAntesProvision + 5);
    console.log("OK - pedido mensual completa entrega con stock real consistente");

    console.log("P9.2A - integración Depósito Central/Contable validada correctamente.");
  } finally {
    if (server) await close(server);
    await sequelize.close();
  }
};

main().catch((error) => {
  console.error(`P9.2A integration falló: ${error.stack || error.message}`);
  process.exitCode = 1;
});
