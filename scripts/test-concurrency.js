const assert = require("assert");
const { Op } = require("sequelize");
const app = require("../src/app");
const sequelize = require("../src/config/database");
const {
  Activo,
  Movimiento,
  Insumo,
  MovimientoStock,
  StockOficina,
  ConsumoOficina,
  PedidoInsumo,
  PedidoInsumoDetalle,
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
    replay: response.headers.get("idempotent-replay") === "true",
  };
};

const statusSorted = (results) => results.map((item) => item.status).sort((a, b) => a - b);

const assertStatuses = (results, expected, label) => {
  assert.deepStrictEqual(
    statusSorted(results),
    [...expected].sort((a, b) => a - b),
    `${label}: estados recibidos ${JSON.stringify(results.map((item) => ({ status: item.status, body: item.body })))}`,
  );
  console.log(`OK - ${label}`);
};

const main = async () => {
  let server;

  try {
    server = await listen();
    const base = `http://127.0.0.1:${server.address().port}`;

    const login = async (email) => {
      const result = await request(base, "/api/auth/login", {
        method: "POST",
        body: { email, password: TEST_PASSWORD },
      });
      assert.strictEqual(result.status, 200, `login falló para ${email}`);
      return result.body.token;
    };

    const preparar = async () => {
      const fixture = await resetIntegrationData();
      const [adminToken, responsable1Token] = await Promise.all([
        login(TEST_USERS.admin),
        login(TEST_USERS.responsable1),
      ]);
      return { fixture, adminToken, responsable1Token };
    };

    // 1) Dos egresos manuales compiten por el mismo stock central.
    {
      const { fixture, adminToken } = await preparar();
      await fixture.insumoBase.update({ stock_actual: 10 });

      const body = {
        insumo_id: fixture.insumoBase.id,
        tipo: "EGRESO",
        cantidad: 7,
        oficina_id: fixture.offices.uj1.id,
        motivo: "P6 carrera manual",
      };

      const results = await Promise.all([
        request(base, "/api/movimientos-stock", {
          method: "POST",
          token: adminToken,
          body,
          idempotencyKey: "p6-manual-egreso-a",
        }),
        request(base, "/api/movimientos-stock", {
          method: "POST",
          token: adminToken,
          body,
          idempotencyKey: "p6-manual-egreso-b",
        }),
      ]);

      assertStatuses(results, [201, 400], "egresos manuales concurrentes no sobregiran stock");
      await fixture.insumoBase.reload();
      assert.strictEqual(Number(fixture.insumoBase.stock_actual), 3);
      assert.strictEqual(
        await MovimientoStock.count({
          where: { insumo_id: fixture.insumoBase.id, tipo: "EGRESO" },
        }),
        1,
      );
    }

    // 2) Un doble clic con la misma Idempotency-Key se ejecuta una sola vez.
    {
      const { fixture, adminToken } = await preparar();
      await fixture.insumoBase.update({ stock_actual: 20 });

      const body = {
        insumo_id: fixture.insumoBase.id,
        oficina_id: fixture.offices.uj1.id,
        cantidad: 5,
        motivo: "P6 idempotencia asignación",
      };
      const key = "p6-asignacion-idem-001";

      const results = await Promise.all([
        request(base, "/api/stock-oficina/asignar", {
          method: "POST",
          token: adminToken,
          body,
          idempotencyKey: key,
        }),
        request(base, "/api/stock-oficina/asignar", {
          method: "POST",
          token: adminToken,
          body,
          idempotencyKey: key,
        }),
      ]);

      assertStatuses(results, [200, 200], "Idempotency-Key evita doble asignación");
      assert.strictEqual(results.filter((item) => item.replay).length, 1);

      await fixture.insumoBase.reload();
      assert.strictEqual(Number(fixture.insumoBase.stock_actual), 15);

      const stock = await StockOficina.findOne({
        where: {
          insumo_id: fixture.insumoBase.id,
          oficina_id: fixture.offices.uj1.id,
        },
      });
      assert.strictEqual(Number(stock.cantidad), 5);
      assert.strictEqual(
        await MovimientoStock.count({
          where: { insumo_id: fixture.insumoBase.id, tipo: "EGRESO" },
        }),
        1,
      );

      const conflict = await request(base, "/api/stock-oficina/asignar", {
        method: "POST",
        token: adminToken,
        body: { ...body, cantidad: 6 },
        idempotencyKey: key,
      });
      assert.strictEqual(conflict.status, 409);
      await fixture.insumoBase.reload();
      assert.strictEqual(Number(fixture.insumoBase.stock_actual), 15);
      console.log("OK - una Idempotency-Key no puede reutilizarse con otro payload");
    }

    // 3) Dos asignaciones distintas compiten correctamente por stock central.
    {
      const { fixture, adminToken } = await preparar();
      await fixture.insumoBase.update({ stock_actual: 10 });

      const results = await Promise.all([
        request(base, "/api/stock-oficina/asignar", {
          method: "POST",
          token: adminToken,
          idempotencyKey: "p6-asignacion-race-uj1",
          body: {
            insumo_id: fixture.insumoBase.id,
            oficina_id: fixture.offices.uj1.id,
            cantidad: 7,
          },
        }),
        request(base, "/api/stock-oficina/asignar", {
          method: "POST",
          token: adminToken,
          idempotencyKey: "p6-asignacion-race-uj2",
          body: {
            insumo_id: fixture.insumoBase.id,
            oficina_id: fixture.offices.uj2.id,
            cantidad: 7,
          },
        }),
      ]);

      assertStatuses(results, [200, 400], "asignaciones concurrentes serializan stock central");
      await fixture.insumoBase.reload();
      assert.strictEqual(Number(fixture.insumoBase.stock_actual), 3);
      assert.strictEqual(
        Number(
          (await StockOficina.sum("cantidad", {
            where: { insumo_id: fixture.insumoBase.id },
          })) || 0,
        ),
        7,
      );
    }

    // 4) El consumo de oficina también es atómico e idempotente.
    {
      const { fixture, responsable1Token } = await preparar();
      await StockOficina.create({
        insumo_id: fixture.insumoBase.id,
        oficina_id: fixture.offices.uj1.id,
        cantidad: 10,
      });

      const body = {
        oficina_id: fixture.offices.uj1.id,
        insumo_id: fixture.insumoBase.id,
        mes: 9,
        anio: 2099,
        cantidad_consumida: 4,
        observaciones: "P6 consumo idempotente",
      };
      const key = "p6-consumo-idem-001";

      const results = await Promise.all([
        request(base, "/api/consumo-oficina", {
          method: "POST",
          token: responsable1Token,
          body,
          idempotencyKey: key,
        }),
        request(base, "/api/consumo-oficina", {
          method: "POST",
          token: responsable1Token,
          body,
          idempotencyKey: key,
        }),
      ]);

      assertStatuses(results, [201, 201], "doble consumo con misma clave se ejecuta una vez");
      assert.strictEqual(results.filter((item) => item.replay).length, 1);

      const stock = await StockOficina.findOne({
        where: {
          insumo_id: fixture.insumoBase.id,
          oficina_id: fixture.offices.uj1.id,
        },
      });
      assert.strictEqual(Number(stock.cantidad), 6);
      assert.strictEqual(await ConsumoOficina.count(), 1);
    }

    // 5) Dos consumos distintos no pueden gastar el mismo saldo.
    {
      const { fixture, responsable1Token } = await preparar();
      await StockOficina.create({
        insumo_id: fixture.insumoBase.id,
        oficina_id: fixture.offices.uj1.id,
        cantidad: 5,
      });
      const baseBody = {
        oficina_id: fixture.offices.uj1.id,
        insumo_id: fixture.insumoBase.id,
        mes: 9,
        anio: 2099,
        cantidad_consumida: 4,
      };

      const results = await Promise.all([
        request(base, "/api/consumo-oficina", {
          method: "POST",
          token: responsable1Token,
          body: { ...baseBody, observaciones: "carrera A" },
          idempotencyKey: "p6-consumo-race-a",
        }),
        request(base, "/api/consumo-oficina", {
          method: "POST",
          token: responsable1Token,
          body: { ...baseBody, observaciones: "carrera B" },
          idempotencyKey: "p6-consumo-race-b",
        }),
      ]);

      assertStatuses(results, [201, 400], "consumos concurrentes no dejan stock negativo");
      const stock = await StockOficina.findOne({
        where: {
          insumo_id: fixture.insumoBase.id,
          oficina_id: fixture.offices.uj1.id,
        },
      });
      assert.strictEqual(Number(stock.cantidad), 1);
      assert.strictEqual(await ConsumoOficina.count(), 1);
    }

    // 6) Una baja repetida con la misma clave no duplica historial.
    {
      const { fixture, adminToken } = await preparar();
      const key = "p6-activo-baja-idem-001";

      const results = await Promise.all([
        request(base, `/api/activos/${fixture.activoBase.id}/baja`, {
          method: "PATCH",
          token: adminToken,
          idempotencyKey: key,
        }),
        request(base, `/api/activos/${fixture.activoBase.id}/baja`, {
          method: "PATCH",
          token: adminToken,
          idempotencyKey: key,
        }),
      ]);

      assertStatuses(results, [200, 200], "baja idempotente devuelve la misma operación");
      assert.strictEqual(results.filter((item) => item.replay).length, 1);
      await fixture.activoBase.reload();
      assert.strictEqual(fixture.activoBase.activo, false);
      assert.strictEqual(fixture.activoBase.estado, "Dado de baja");
      assert.strictEqual(
        await Movimiento.count({
          where: { activo_id: fixture.activoBase.id, tipo: "BAJA" },
        }),
        1,
      );
    }

    // 7) Edición y baja simultáneas nunca pueden reactivar un activo dado de baja.
    {
      const { fixture, adminToken, responsable1Token } = await preparar();

      const results = await Promise.all([
        request(base, `/api/activos/${fixture.activoBase.id}`, {
          method: "PUT",
          token: responsable1Token,
          idempotencyKey: "p6-activo-update-race",
          body: { marca: "Marca concurrente P6" },
        }),
        request(base, `/api/activos/${fixture.activoBase.id}/baja`, {
          method: "PATCH",
          token: adminToken,
          idempotencyKey: "p6-activo-baja-race",
        }),
      ]);

      assert.strictEqual(results.find((item) => item.status === 200) !== undefined, true);
      assert.strictEqual(results.every((item) => [200, 409].includes(item.status)), true);
      await fixture.activoBase.reload();
      assert.strictEqual(fixture.activoBase.activo, false);
      assert.strictEqual(fixture.activoBase.estado, "Dado de baja");
      assert.strictEqual(
        await Movimiento.count({
          where: { activo_id: fixture.activoBase.id, tipo: "BAJA" },
        }),
        1,
      );
      console.log("OK - edición y baja concurrentes preservan la baja definitiva");
    }

    // 8) El índice único evita dos altas concurrentes con el mismo código.
    {
      const { fixture, responsable1Token } = await preparar();
      const payload = {
        codigo_interno: "P6-CODIGO-UNICO-001",
        nombre: "Activo concurrente P6",
        categoria_id: fixture.categoria.id,
        oficina_id: fixture.offices.uj1.id,
        cantidad: 1,
        estado: "Buen estado",
      };

      const results = await Promise.all([
        request(base, "/api/activos", {
          method: "POST",
          token: responsable1Token,
          body: payload,
          idempotencyKey: "p6-activo-create-a",
        }),
        request(base, "/api/activos", {
          method: "POST",
          token: responsable1Token,
          body: payload,
          idempotencyKey: "p6-activo-create-b",
        }),
      ]);

      assertStatuses(results, [201, 409], "código interno único resiste altas concurrentes");
      assert.strictEqual(
        await Activo.count({ where: { codigo_interno: payload.codigo_interno } }),
        1,
      );
    }

    // 9) La unicidad oficina/mes/año resiste doble creación de pedido.
    {
      const { fixture, responsable1Token } = await preparar();
      const payload = {
        mes: 10,
        anio: 2099,
        cantidad_hechos_delictivos: 2,
        cantidad_autopsias: 0,
        detalles: [
          {
            insumo_id: fixture.insumoBase.id,
            cantidad_solicitada: 5,
          },
        ],
      };

      const results = await Promise.all([
        request(base, "/api/pedidos", {
          method: "POST",
          token: responsable1Token,
          body: payload,
        }),
        request(base, "/api/pedidos", {
          method: "POST",
          token: responsable1Token,
          body: payload,
        }),
      ]);

      assertStatuses(results, [201, 409], "doble creación de pedido produce una sola fila");
      assert.strictEqual(
        await PedidoInsumo.count({
          where: {
            oficina_id: fixture.offices.uj1.id,
            mes: 10,
            anio: 2099,
          },
        }),
        1,
      );
    }

    // 10) Dos cambios administrativos incompatibles se serializan.
    {
      const { fixture, adminToken } = await preparar();
      const pedido = await PedidoInsumo.create({
        usuario_id: fixture.users.responsable1.id,
        oficina_id: fixture.offices.uj1.id,
        mes: 11,
        anio: 2099,
        estado: "ENVIADO",
        fecha_envio: new Date(),
      });

      const results = await Promise.all([
        request(base, `/api/pedidos/${pedido.id}/estado`, {
          method: "PUT",
          token: adminToken,
          body: { estado: "APROBADO" },
          idempotencyKey: "p6-pedido-estado-aprobado",
        }),
        request(base, `/api/pedidos/${pedido.id}/estado`, {
          method: "PUT",
          token: adminToken,
          body: { estado: "RECHAZADO" },
          idempotencyKey: "p6-pedido-estado-rechazado",
        }),
      ]);

      assertStatuses(results, [200, 409], "estados incompatibles no se pisan entre sí");
      await pedido.reload();
      assert.strictEqual(["APROBADO", "RECHAZADO"].includes(pedido.estado), true);
    }

    // 11) Dos provisiones idénticas del mismo pedido no descuentan dos veces.
    {
      const { fixture, adminToken } = await preparar();
      await fixture.insumoBase.update({ stock_actual: 20 });
      const pedido = await PedidoInsumo.create({
        usuario_id: fixture.users.responsable1.id,
        oficina_id: fixture.offices.uj1.id,
        mes: 12,
        anio: 2099,
        estado: "APROBADO",
        fecha_envio: new Date(),
      });
      const detalle = await PedidoInsumoDetalle.create({
        pedido_id: pedido.id,
        insumo_id: fixture.insumoBase.id,
        cantidad_solicitada: 10,
        cantidad_provista: 0,
      });
      const body = {
        estado: "APROBADO",
        detalles: [{ id: detalle.id, cantidad_provista: 7 }],
      };

      const results = await Promise.all([
        request(base, `/api/pedidos/${pedido.id}/proveer`, {
          method: "PUT",
          token: adminToken,
          body,
        }),
        request(base, `/api/pedidos/${pedido.id}/proveer`, {
          method: "PUT",
          token: adminToken,
          body,
        }),
      ]);

      assertStatuses(results, [200, 200], "provisión repetida aplica solo la diferencia real");
      await fixture.insumoBase.reload();
      await detalle.reload();
      assert.strictEqual(Number(fixture.insumoBase.stock_actual), 13);
      assert.strictEqual(Number(detalle.cantidad_provista), 7);
      const stock = await StockOficina.findOne({
        where: {
          insumo_id: fixture.insumoBase.id,
          oficina_id: fixture.offices.uj1.id,
        },
      });
      assert.strictEqual(Number(stock.cantidad), 7);
      assert.strictEqual(
        await MovimientoStock.count({
          where: {
            insumo_id: fixture.insumoBase.id,
            oficina_id: fixture.offices.uj1.id,
            tipo: "EGRESO",
          },
        }),
        1,
      );
    }

    // 12) Dos pedidos distintos no pueden consumir simultáneamente más stock del disponible.
    {
      const { fixture, adminToken } = await preparar();
      await fixture.insumoBase.update({ stock_actual: 10 });

      const pedidos = await Promise.all([
        PedidoInsumo.create({
          usuario_id: fixture.users.responsable1.id,
          oficina_id: fixture.offices.uj1.id,
          mes: 1,
          anio: 2100,
          estado: "APROBADO",
          fecha_envio: new Date(),
        }),
        PedidoInsumo.create({
          usuario_id: fixture.users.responsable2.id,
          oficina_id: fixture.offices.uj2.id,
          mes: 1,
          anio: 2100,
          estado: "APROBADO",
          fecha_envio: new Date(),
        }),
      ]);

      const detalles = await Promise.all(
        pedidos.map((pedido) =>
          PedidoInsumoDetalle.create({
            pedido_id: pedido.id,
            insumo_id: fixture.insumoBase.id,
            cantidad_solicitada: 7,
            cantidad_provista: 0,
          }),
        ),
      );

      const results = await Promise.all(
        pedidos.map((pedido, index) =>
          request(base, `/api/pedidos/${pedido.id}/proveer`, {
            method: "PUT",
            token: adminToken,
            body: {
              estado: "APROBADO",
              detalles: [
                {
                  id: detalles[index].id,
                  cantidad_provista: 7,
                },
              ],
            },
          }),
        ),
      );

      assertStatuses(results, [200, 400], "pedidos concurrentes compiten por stock sin sobregiro");
      await fixture.insumoBase.reload();
      assert.strictEqual(Number(fixture.insumoBase.stock_actual), 3);
      assert.strictEqual(
        Number(
          (await StockOficina.sum("cantidad", {
            where: {
              insumo_id: fixture.insumoBase.id,
              oficina_id: { [Op.in]: [fixture.offices.uj1.id, fixture.offices.uj2.id] },
            },
          })) || 0,
        ),
        7,
      );
    }

    console.log("\n✓ P6 concurrency suite completada correctamente.");
  } finally {
    if (server) await close(server);
    await sequelize.close();
  }
};

main().catch((error) => {
  console.error(`✗ P6 concurrency suite falló: ${error.stack || error.message}`);
  process.exitCode = 1;
});
