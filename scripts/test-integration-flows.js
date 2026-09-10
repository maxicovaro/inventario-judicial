const assert = require("assert");
const app = require("../src/app");
const sequelize = require("../src/config/database");
const {
  Usuario,
  Movimiento,
  Insumo,
  StockOficina,
  PedidoInsumo,
  PedidoInsumoDetalle,
  MovimientoStock,
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

    const login = async (email, password = TEST_PASSWORD, expected = 200) => {
      const result = await request(base, "/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      const body = expectStatus(result, expected, `login ${email} -> ${expected}`);
      return { ...result, token: body?.token, usuario: body?.usuario };
    };

    // --- Autenticación y administración de usuarios ---
    expectStatus(
      await request(base, "/api/activos"),
      401,
      "rechaza acceso sin token",
    );

    const adminLogin = await login(TEST_USERS.admin);
    const responsable1Login = await login(TEST_USERS.responsable1);
    const responsable2Login = await login(TEST_USERS.responsable2);
    const usuario1Login = await login(TEST_USERS.usuario1);

    assert.strictEqual(adminLogin.usuario.role, "ADMIN");
    assert.strictEqual(adminLogin.usuario.oficina_es_central, true);
    assert.strictEqual(responsable1Login.usuario.role, "RESPONSABLE");
    assert.strictEqual(usuario1Login.usuario.role, "USUARIO");
    console.log("OK - roles y oficina central llegan correctamente desde login");

    expectStatus(
      await request(base, "/api/usuarios", {
        token: responsable1Login.token,
      }),
      403,
      "RESPONSABLE no administra usuarios",
    );

    const createdEmail = "usuario.creado@inventario.test";
    const createdUserBody = expectStatus(
      await request(base, "/api/usuarios", {
        method: "POST",
        token: adminLogin.token,
        body: {
          nombre: "Creado",
          apellido: "Por Integración",
          email: createdEmail,
          password: TEST_PASSWORD,
          role_id: fixture.roles.usuario.id,
          oficina_id: fixture.offices.uj2.id,
        },
      }),
      201,
      "Admin General crea usuario",
    );

    const createdUserId = createdUserBody.usuario.id;

    expectStatus(
      await request(base, "/api/usuarios", {
        method: "POST",
        token: adminLogin.token,
        body: {
          nombre: "Admin inválido",
          apellido: "Integración",
          email: "admin.invalido@inventario.test",
          password: TEST_PASSWORD,
          role_id: fixture.roles.admin.id,
          oficina_id: fixture.offices.uj1.id,
        },
      }),
      400,
      "no permite ADMIN fuera de oficina central",
    );

    for (let intento = 1; intento <= 3; intento += 1) {
      await login(createdEmail, "Clave#Incorrecta2026", 401);
    }
    await login(createdEmail, TEST_PASSWORD, 403);

    expectStatus(
      await request(base, `/api/usuarios/${createdUserId}/desbloquear`, {
        method: "PATCH",
        token: adminLogin.token,
      }),
      200,
      "Admin General desbloquea usuario",
    );
    await login(createdEmail);

    expectStatus(
      await request(base, `/api/usuarios/${createdUserId}/estado`, {
        method: "PATCH",
        token: adminLogin.token,
      }),
      200,
      "Admin General desactiva usuario",
    );
    await login(createdEmail, TEST_PASSWORD, 403);

    // --- Activos, alcance por oficina e historial ---
    const assetPayload = {
      codigo_interno: "INT-P4-001",
      nombre: "Notebook Integración P4",
      descripcion: "Creada mediante API de integración",
      categoria_id: fixture.categoria.id,
      oficina_id: fixture.offices.uj2.id,
      cantidad: 1,
      estado: "Buen estado",
    };

    const createdAssetBody = expectStatus(
      await request(base, "/api/activos", {
        method: "POST",
        token: responsable1Login.token,
        body: assetPayload,
      }),
      201,
      "RESPONSABLE crea activo",
    );

    const assetId = createdAssetBody.activo.id;
    assert.strictEqual(
      Number(createdAssetBody.activo.oficina_id),
      Number(fixture.offices.uj1.id),
      "el backend debe forzar la oficina propia del RESPONSABLE",
    );
    console.log("OK - RESPONSABLE no puede elegir otra oficina al crear activo");

    expectStatus(
      await request(base, "/api/activos", {
        method: "POST",
        token: usuario1Login.token,
        body: { ...assetPayload, codigo_interno: "INT-P4-USER" },
      }),
      403,
      "USUARIO no crea activos",
    );

    expectStatus(
      await request(base, `/api/activos/${assetId}`, {
        method: "PUT",
        token: responsable2Login.token,
        body: { marca: "Intento cruzado" },
      }),
      403,
      "RESPONSABLE no edita activo de otra oficina",
    );

    expectStatus(
      await request(base, `/api/activos/${assetId}`, {
        method: "PUT",
        token: responsable1Login.token,
        body: { marca: "Marca Integración" },
      }),
      200,
      "RESPONSABLE edita activo propio",
    );

    expectStatus(
      await request(base, `/api/activos/${assetId}`, {
        method: "PUT",
        token: adminLogin.token,
        body: {
          oficina_id: fixture.offices.uj2.id,
          estado: "Regular estado",
        },
      }),
      200,
      "Admin traslada activo y cambia estado",
    );

    const movimientosAdmin = expectStatus(
      await request(base, "/api/movimientos", { token: adminLogin.token }),
      200,
      "Admin consulta historial global",
    );
    const tipos = movimientosAdmin
      .filter((movimiento) => Number(movimiento.activo_id) === Number(assetId))
      .map((movimiento) => movimiento.tipo);

    for (const tipo of ["ALTA", "ACTUALIZACION", "TRASLADO", "CAMBIO_ESTADO"]) {
      assert.ok(tipos.includes(tipo), `falta movimiento ${tipo} del activo`);
    }
    console.log("OK - historial conserva ALTA, ACTUALIZACION, TRASLADO y CAMBIO_ESTADO");

    const activosResp1 = expectStatus(
      await request(base, "/api/activos", { token: responsable1Login.token }),
      200,
      "RESPONSABLE UJ1 lista sus activos",
    );
    assert.ok(!activosResp1.some((activo) => Number(activo.id) === Number(assetId)));

    const activosResp2 = expectStatus(
      await request(base, "/api/activos", { token: responsable2Login.token }),
      200,
      "RESPONSABLE UJ2 ve activo trasladado",
    );
    assert.ok(activosResp2.some((activo) => Number(activo.id) === Number(assetId)));
    console.log("OK - el alcance de lectura sigue la oficina actual del activo");

    expectStatus(
      await request(base, "/api/movimientos", {
        method: "POST",
        token: responsable1Login.token,
        body: {
          activo_id: assetId,
          tipo: "REPARACION",
          descripcion: "Intento desde oficina anterior",
        },
      }),
      403,
      "RESPONSABLE no registra movimiento en otra oficina",
    );

    expectStatus(
      await request(base, "/api/movimientos", {
        method: "POST",
        token: responsable2Login.token,
        body: { activo_id: assetId, tipo: "TRASLADO" },
      }),
      400,
      "movimiento estructural manual está bloqueado",
    );

    expectStatus(
      await request(base, "/api/movimientos", {
        method: "POST",
        token: responsable2Login.token,
        body: {
          activo_id: assetId,
          tipo: "REPARACION",
          descripcion: "Revisión técnica",
        },
      }),
      201,
      "RESPONSABLE registra reparación de activo propio",
    );

    expectStatus(
      await request(base, `/api/activos/${assetId}/baja`, {
        method: "PATCH",
        token: responsable2Login.token,
      }),
      403,
      "RESPONSABLE no puede dar de baja",
    );

    expectStatus(
      await request(base, `/api/activos/${assetId}/baja`, {
        method: "PATCH",
        token: adminLogin.token,
      }),
      200,
      "Admin General realiza baja formal",
    );

    expectStatus(
      await request(base, "/api/movimientos", {
        method: "POST",
        token: responsable2Login.token,
        body: { activo_id: assetId, tipo: "REPARACION" },
      }),
      409,
      "activo dado de baja no admite movimiento manual",
    );

    // --- Stock central y alcance de oficina ---
    expectStatus(
      await request(base, "/api/insumos", {
        method: "POST",
        token: responsable1Login.token,
        body: { nombre: "Insumo prohibido", stock_actual: 1 },
      }),
      403,
      "RESPONSABLE no administra stock central",
    );

    const createdInsumoBody = expectStatus(
      await request(base, "/api/insumos", {
        method: "POST",
        token: adminLogin.token,
        body: {
          nombre: "Toner Integración P4",
          categoria: "Informática",
          unidad_medida: "unidad",
          stock_actual: 50,
          stock_minimo: 5,
          proveedor: "Proveedor de prueba",
        },
      }),
      201,
      "Admin General crea insumo central",
    );
    const insumoId = createdInsumoBody.insumo.id;

    const asignacionBody = expectStatus(
      await request(base, "/api/stock-oficina/asignar", {
        method: "POST",
        token: adminLogin.token,
        body: {
          insumo_id: insumoId,
          oficina_id: fixture.offices.uj1.id,
          cantidad: 10,
          motivo: "Asignación de integración",
        },
      }),
      200,
      "Admin asigna stock a UJ1",
    );
    assert.strictEqual(Number(asignacionBody.stock_central), 40);
    assert.strictEqual(Number(asignacionBody.stock_oficina), 10);

    const stockUj1 = expectStatus(
      await request(base, `/api/stock-oficina/${fixture.offices.uj1.id}`, {
        token: responsable1Login.token,
      }),
      200,
      "RESPONSABLE consulta stock propio",
    );
    const tonerUj1 = stockUj1.find(
      (item) => Number(item.insumo_id) === Number(insumoId),
    );
    assert.ok(tonerUj1);
    assert.strictEqual(Number(tonerUj1.cantidad), 10);

    expectStatus(
      await request(base, `/api/stock-oficina/${fixture.offices.uj2.id}`, {
        token: responsable1Login.token,
      }),
      403,
      "RESPONSABLE no consulta stock de otra oficina",
    );

    expectStatus(
      await request(base, "/api/stock-oficina/asignar", {
        method: "POST",
        token: responsable1Login.token,
        body: {
          insumo_id: insumoId,
          oficina_id: fixture.offices.uj1.id,
          cantidad: 1,
        },
      }),
      403,
      "RESPONSABLE no asigna stock central",
    );

    // --- Pedido mensual y provisión real de stock ---
    const pedidoBody = expectStatus(
      await request(base, "/api/pedidos", {
        method: "POST",
        token: responsable1Login.token,
        body: {
          mes: 11,
          anio: 2026,
          cantidad_hechos_delictivos: 12,
          cantidad_autopsias: 1,
          observaciones: "Pedido de integración P4",
          detalles: [
            {
              insumo_id: insumoId,
              cantidad_solicitada: 5,
              cantidad_provista: 0,
            },
          ],
        },
      }),
      201,
      "RESPONSABLE crea pedido mensual",
    );
    const pedidoId = pedidoBody.pedido.id;

    expectStatus(
      await request(base, "/api/pedidos", {
        method: "POST",
        token: responsable1Login.token,
        body: {
          mes: 11,
          anio: 2026,
          detalles: [{ insumo_id: insumoId, cantidad_solicitada: 1 }],
        },
      }),
      400,
      "pedido mensual duplicado se rechaza",
    );

    expectStatus(
      await request(base, "/api/pedidos", {
        method: "POST",
        token: usuario1Login.token,
        body: {
          mes: 12,
          anio: 2026,
          detalles: [
            {
              insumo_id: insumoId,
              cantidad_solicitada: 1,
              cantidad_provista: 1,
            },
          ],
        },
      }),
      403,
      "oficina no puede autodefinir cantidad provista",
    );

    const pedidosResp2 = expectStatus(
      await request(base, "/api/pedidos", { token: responsable2Login.token }),
      200,
      "RESPONSABLE UJ2 lista pedidos propios",
    );
    assert.ok(!pedidosResp2.some((pedido) => Number(pedido.id) === Number(pedidoId)));

    const pedidosAdmin = expectStatus(
      await request(base, "/api/pedidos", { token: adminLogin.token }),
      200,
      "Admin General lista pedidos globales",
    );
    assert.ok(pedidosAdmin.some((pedido) => Number(pedido.id) === Number(pedidoId)));

    expectStatus(
      await request(base, `/api/pedidos/${pedidoId}/estado`, {
        method: "PUT",
        token: responsable1Login.token,
        body: { estado: "APROBADO" },
      }),
      403,
      "RESPONSABLE no cambia estado administrativo del pedido",
    );

    expectStatus(
      await request(base, `/api/pedidos/${pedidoId}/estado`, {
        method: "PUT",
        token: adminLogin.token,
        body: { estado: "APROBADO" },
      }),
      200,
      "Admin General aprueba pedido",
    );

    const detalle = await PedidoInsumoDetalle.findOne({
      where: { pedido_id: pedidoId, insumo_id: insumoId },
    });
    assert.ok(detalle, "debe existir detalle del pedido");

    expectStatus(
      await request(base, `/api/pedidos/${pedidoId}/proveer`, {
        method: "PUT",
        token: adminLogin.token,
        body: {
          estado: "ENTREGADO",
          detalles: [{ id: detalle.id, cantidad_provista: 3 }],
        },
      }),
      200,
      "Admin provee pedido y lo entrega",
    );

    const [insumoFinal, stockFinal, pedidoFinal, detalleFinal] = await Promise.all([
      Insumo.findByPk(insumoId),
      StockOficina.findOne({
        where: { insumo_id: insumoId, oficina_id: fixture.offices.uj1.id },
      }),
      PedidoInsumo.findByPk(pedidoId),
      PedidoInsumoDetalle.findByPk(detalle.id),
    ]);

    assert.strictEqual(Number(insumoFinal.stock_actual), 37);
    assert.strictEqual(Number(stockFinal.cantidad), 13);
    assert.strictEqual(pedidoFinal.estado, "ENTREGADO");
    assert.strictEqual(Number(detalleFinal.cantidad_provista), 3);
    console.log("OK - provisión mantiene consistencia entre pedido, stock central y stock de oficina");

    const movimientosStock = await MovimientoStock.findAll({
      where: { insumo_id: insumoId, oficina_id: fixture.offices.uj1.id },
    });
    assert.ok(movimientosStock.length >= 2);
    console.log("OK - transferencias de stock dejan historial persistente");

    expectStatus(
      await request(base, `/api/pedidos/${pedidoId}/proveer`, {
        method: "PUT",
        token: adminLogin.token,
        body: { detalles: [{ id: detalle.id, cantidad_provista: 4 }] },
      }),
      409,
      "pedido ENTREGADO no puede reprovisionarse",
    );

    // --- Persistencia final mínima ---
    const baja = await Movimiento.findOne({
      where: { activo_id: assetId, tipo: "BAJA" },
    });
    assert.ok(baja, "la baja formal debe persistir movimiento BAJA");

    const createdUser = await Usuario.findByPk(createdUserId);
    assert.strictEqual(createdUser.activo, false);
    console.log("OK - estado de usuario y baja formal persistieron en MySQL");

    console.log("");
    console.log("✓ P4 integración completa: auth, usuarios, activos, movimientos, stock y pedidos.");
  } finally {
    if (server) await close(server);
    await sequelize.close();
  }
};

main().catch((error) => {
  console.error("");
  console.error(`✗ Integración P4 falló: ${error.stack || error.message}`);
  process.exitCode = 1;
});
