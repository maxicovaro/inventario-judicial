const assert = require("assert");
const app = require("../src/app");
const sequelize = require("../src/config/database");
const {
  Activo,
  Movimiento,
  MovimientoStock,
  Bitacora,
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
    const contable2Token = await login(TEST_USERS.responsableContable2);
    const usuarioContableToken = await login(TEST_USERS.usuarioContable);
    const informaticaToken = await login(TEST_USERS.responsableInformatica);

    const contableMe = expectStatus(
      await request(base, "/api/auth/me", { token: contableToken }),
      200,
      "primer RESPONSABLE de Contable obtiene sesión",
    );
    const contable2Me = expectStatus(
      await request(base, "/api/auth/me", { token: contable2Token }),
      200,
      "segundo RESPONSABLE de Contable obtiene sesión",
    );
    const usuarioContableMe = expectStatus(
      await request(base, "/api/auth/me", { token: usuarioContableToken }),
      200,
      "USUARIO de Contable obtiene sesión",
    );
    const informaticaMe = expectStatus(
      await request(base, "/api/auth/me", { token: informaticaToken }),
      200,
      "RESPONSABLE de Informática obtiene sesión",
    );

    assert.strictEqual(contableMe.usuario.role, "RESPONSABLE");
    assert.strictEqual(contable2Me.usuario.role, "RESPONSABLE");
    assert.strictEqual(contableMe.usuario.oficina_gestiona_deposito, true);
    assert.strictEqual(contable2Me.usuario.oficina_gestiona_deposito, true);
    assert.strictEqual(usuarioContableMe.usuario.role, "USUARIO");
    assert.strictEqual(usuarioContableMe.usuario.oficina_gestiona_deposito, true);
    assert.strictEqual(informaticaMe.usuario.oficina_gestiona_deposito, false);
    console.log(
      "OK - la oficina puede tener múltiples RESPONSABLE de depósito sin habilitar a usuarios comunes",
    );

    const contexto = expectStatus(
      await request(base, "/api/deposito/contexto", { token: contableToken }),
      200,
      "primer responsable de Contable accede al Depósito Central",
    );
    assert.strictEqual(contexto.deposito.id, fixture.offices.deposito.id);
    assert.strictEqual(contexto.oficina_gestora.id, fixture.offices.contable.id);

    expectStatus(
      await request(base, "/api/deposito/contexto", { token: contable2Token }),
      200,
      "segundo responsable de Contable también accede al Depósito Central",
    );

    expectStatus(
      await request(base, "/api/deposito/contexto", { token: usuarioContableToken }),
      403,
      "usuario común de Contable no administra Depósito Central",
    );

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
      "primer responsable ingresa activo al Depósito Central",
    );

    let activoDeposito = await Activo.findByPk(activoDepositoBody.activo.id);
    assert.strictEqual(activoDeposito.oficina_id, fixture.offices.deposito.id);

    const altaDeposito = await Movimiento.findOne({
      where: { activo_id: activoDeposito.id, tipo: "ALTA" },
    });
    assert.ok(altaDeposito, "El ingreso del activo debe generar movimiento ALTA");
    assert.strictEqual(
      altaDeposito.usuario_id,
      fixture.users.responsableContable.id,
      "El ALTA debe identificar al empleado que recibió/cargó el bien",
    );
    console.log("OK - recepción de activo queda atribuida al responsable concreto");

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
        token: contable2Token,
        body: { oficina_destino_id: fixture.offices.informatica.id },
        idempotencyKey: "p9-deposito-transfer-asset-001",
      }),
      200,
      "segundo responsable entrega activo de depósito a Informática",
    );

    activoDeposito = await Activo.findByPk(activoDeposito.id);
    assert.strictEqual(activoDeposito.oficina_id, fixture.offices.informatica.id);
    const traslado = await Movimiento.findOne({
      where: { activo_id: activoDeposito.id, tipo: "TRASLADO" },
    });
    assert.ok(traslado, "La entrega debe generar movimiento TRASLADO");
    assert.strictEqual(
      traslado.usuario_id,
      fixture.users.responsableContable2.id,
      "El TRASLADO debe identificar al empleado que realizó la entrega",
    );
    assert.match(traslado.descripcion, /Depósito/i);
    assert.match(traslado.descripcion, /Informática/i);
    console.log(
      "OK - recepción y entrega patrimonial pueden ser realizadas por empleados distintos y quedan individualizadas",
    );

    const insumoAntesIngreso = await Insumo.findByPk(fixture.insumoBase.id);
    const stockAntesIngreso = Number(insumoAntesIngreso.stock_actual);

    expectStatus(
      await request(base, "/api/deposito/movimientos", {
        method: "POST",
        token: contable2Token,
        body: {
          insumo_id: fixture.insumoBase.id,
          tipo: "INGRESO",
          cantidad: 7,
          motivo: "Recepción de resmas para prueba multiusuario",
        },
        idempotencyKey: "p9-deposito-ingreso-stock-001",
      }),
      201,
      "segundo responsable registra recepción de insumos",
    );

    const ingresoStock = await MovimientoStock.findOne({
      where: {
        insumo_id: fixture.insumoBase.id,
        tipo: "INGRESO",
        motivo: "Recepción de resmas para prueba multiusuario",
      },
      order: [["id", "DESC"]],
    });
    assert.ok(ingresoStock, "La recepción de insumos debe generar MovimientoStock");
    assert.strictEqual(
      ingresoStock.usuario_id,
      fixture.users.responsableContable2.id,
      "El ingreso de stock debe identificar al empleado receptor",
    );
    const insumoTrasIngreso = await Insumo.findByPk(fixture.insumoBase.id);
    assert.strictEqual(Number(insumoTrasIngreso.stock_actual), stockAntesIngreso + 7);
    console.log("OK - recepción de insumos queda atribuida al responsable concreto");

    const stockCentralAntes = Number(insumoTrasIngreso.stock_actual);

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
      "primer responsable distribuye insumos a Informática",
    );

    const insumoDespues = await Insumo.findByPk(fixture.insumoBase.id);
    const stockInformatica = await StockOficina.findOne({
      where: {
        insumo_id: fixture.insumoBase.id,
        oficina_id: fixture.offices.informatica.id,
      },
    });
    const egresoStock = await MovimientoStock.findOne({
      where: {
        insumo_id: fixture.insumoBase.id,
        tipo: "EGRESO",
        oficina_id: fixture.offices.informatica.id,
        motivo: "Entrega piloto a Informática",
      },
      order: [["id", "DESC"]],
    });
    assert.strictEqual(Number(insumoDespues.stock_actual), stockCentralAntes - 10);
    assert.strictEqual(Number(stockInformatica.cantidad), 10);
    assert.ok(egresoStock, "La entrega debe generar MovimientoStock EGRESO");
    assert.strictEqual(
      egresoStock.usuario_id,
      fixture.users.responsableContable.id,
      "La entrega de stock debe identificar al empleado que la realizó",
    );
    console.log(
      "OK - recepción y entrega de stock por responsables diferentes conservan autor individual",
    );

    expectStatus(
      await request(base, "/api/deposito/stock/asignar", {
        method: "POST",
        token: usuarioContableToken,
        body: {
          insumo_id: fixture.insumoBase.id,
          oficina_id: fixture.offices.informatica.id,
          cantidad: 1,
        },
      }),
      403,
      "usuario común de Contable no puede distribuir stock central",
    );

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
          token: contable2Token,
          body: {
            estado: "APROBADA",
            respuesta_admin: "Aprobada para gestión del Depósito Central",
          },
        },
      ),
      200,
      "segundo responsable responde solicitud institucional",
    );
    const solicitudDb = await Solicitud.findByPk(solicitudBody.solicitud.id);
    assert.strictEqual(solicitudDb.estado, "APROBADA");
    const bitacoraSolicitud = await Bitacora.findOne({
      where: {
        accion: "RESPONDER_SOLICITUD",
        modulo: "SOLICITUDES",
        usuario_id: fixture.users.responsableContable2.id,
      },
      order: [["id", "DESC"]],
    });
    assert.ok(
      bitacoraSolicitud,
      "La respuesta de solicitud debe identificar en bitácora al empleado responsable",
    );
    console.log("OK - gestión de solicitudes queda individualizada por empleado");

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
      "primer responsable aprueba pedido mensual",
    );

    const bitacoraAprobacion = await Bitacora.findOne({
      where: {
        accion: "CAMBIAR_ESTADO",
        modulo: "PEDIDOS",
        usuario_id: fixture.users.responsableContable.id,
      },
      order: [["id", "DESC"]],
    });
    assert.ok(
      bitacoraAprobacion,
      "El cambio de estado del pedido debe identificar al responsable que lo aprobó",
    );

    const pedidosDeposito = expectStatus(
      await request(base, "/api/deposito/pedidos", { token: contable2Token }),
      200,
      "segundo responsable visualiza pedidos institucionales",
    );
    const pedidoVisible = pedidosDeposito.find((item) => item.id === pedidoId);
    assert.ok(pedidoVisible, "El pedido aprobado debe estar visible en depósito");
    const detalle = pedidoVisible.PedidoInsumoDetalles[0];

    const stockAntesProvision = Number(
      (await Insumo.findByPk(fixture.insumoBase.id)).stock_actual,
    );
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
        token: contable2Token,
        body: {
          estado: "ENTREGADO",
          detalles: [{ id: detalle.id, cantidad_provista: 5 }],
        },
      }),
      200,
      "segundo responsable provisiona y entrega pedido mensual",
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
    const egresoPedido = await MovimientoStock.findOne({
      where: {
        insumo_id: fixture.insumoBase.id,
        tipo: "EGRESO",
        oficina_id: fixture.offices.informatica.id,
      },
      order: [["id", "DESC"]],
    });

    assert.strictEqual(pedidoDb.estado, "ENTREGADO");
    assert.strictEqual(stockTrasProvision, stockAntesProvision - 5);
    assert.strictEqual(stockOficinaTrasProvision, stockOficinaAntesProvision + 5);
    assert.ok(egresoPedido, "La provisión debe generar movimiento de stock");
    assert.strictEqual(
      egresoPedido.usuario_id,
      fixture.users.responsableContable2.id,
      "La provisión debe identificar al empleado que materializó la entrega",
    );
    console.log(
      "OK - aprobación y entrega del mismo pedido pueden recaer en responsables distintos con auditoría individual",
    );

    console.log(
      "P9.2A - integración multiusuario Depósito Central/Contable validada correctamente.",
    );
  } finally {
    if (server) await close(server);
    await sequelize.close();
  }
};

main().catch((error) => {
  console.error(`P9.2A integration falló: ${error.stack || error.message}`);
  process.exitCode = 1;
});
