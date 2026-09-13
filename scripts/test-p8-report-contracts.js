const assert = require("assert");
const app = require("../src/app");
const sequelize = require("../src/config/database");
const { PedidoInsumo, PedidoInsumoDetalle } = require("../src/models");
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
    server.closeIdleConnections?.();
  });

const login = async (base, email) => {
  const response = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  });
  const body = await response.json();
  assert.strictEqual(response.status, 200, `login ${email}`);
  assert.ok(body.token, `login ${email} debe devolver token`);
  return body.token;
};

const main = async () => {
  let server;
  try {
    const fixture = await resetIntegrationData();
    const pedido = await PedidoInsumo.create({
      mes: 9,
      anio: 2026,
      estado: "ENVIADO",
      cantidad_hechos_delictivos: 12,
      cantidad_autopsias: 1,
      oficina_id: fixture.offices.uj1.id,
      usuario_id: fixture.users.responsable1.id,
    });
    await PedidoInsumoDetalle.create({
      pedido_id: pedido.id,
      insumo_id: fixture.insumoBase.id,
      cantidad_solicitada: 14,
      cantidad_provista: 10,
      tuvo_problema: true,
      detalle_problema: "Demora de prueba P8.3",
    });

    server = await listen();
    const base = `http://127.0.0.1:${server.address().port}`;
    const [adminToken, responsableToken] = await Promise.all([
      login(base, TEST_USERS.admin),
      login(base, TEST_USERS.responsable1),
    ]);

    const jsonResponse = await fetch(`${base}/api/reportes-pedidos/resumen`, {
      headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
    });
    assert.strictEqual(jsonResponse.status, 200);
    const resumen = await jsonResponse.json();
    assert.strictEqual(resumen.totalPedidos, 1);
    assert.deepStrictEqual(resumen.porEstado, [{ estado: "ENVIADO", total: 1 }]);
    assert.ok(
      resumen.pedidosPorOficina.some(
        (item) => item.oficina === fixture.offices.uj1.nombre && item.total === 1,
      ),
    );
    assert.ok(
      resumen.insumosMasSolicitados.some(
        (item) => item.nombre === fixture.insumoBase.nombre && item.total_solicitado === 14,
      ),
    );
    assert.ok(
      resumen.insumosConProblemas.some(
        (item) => item.nombre === fixture.insumoBase.nombre && item.total_problemas === 1,
      ),
    );
    console.log("OK - resumen JSON conserva contrato funcional");

    const denied = await fetch(`${base}/api/reportes-pedidos/resumen`, {
      headers: { Authorization: `Bearer ${responsableToken}`, Accept: "application/json" },
    });
    assert.strictEqual(denied.status, 403);
    console.log("OK - reporte general sigue restringido a ADMIN");

    const pdfResponse = await fetch(`${base}/api/reportes-pedidos/resumen/pdf`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(pdfResponse.status, 200);
    assert.match(pdfResponse.headers.get("content-type") || "", /^application\/pdf/);
    const disposition = pdfResponse.headers.get("content-disposition") || "";
    assert.match(disposition, /reporte_general_pedidos\.pdf/);
    const bytes = Buffer.from(await pdfResponse.arrayBuffer());
    assert.ok(bytes.length > 500, "el PDF debe contener datos renderizados");
    assert.strictEqual(bytes.subarray(0, 4).toString("ascii"), "%PDF");
    console.log("OK - PDF continúa transmitiéndose como documento válido");
  } finally {
    if (server) await close(server);
    await sequelize.close();
  }
};

main().catch((error) => {
  console.error(`✗ Contratos P8.3 de reportes fallaron: ${error.stack || error.message}`);
  process.exitCode = 1;
});
