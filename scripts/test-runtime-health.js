const assert = require("assert");
const app = require("../src/app");
const sequelize = require("../src/config/database");

const listen = () =>
  new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
    server.once("error", reject);
  });

const close = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

const main = async () => {
  let server;
  try {
    await sequelize.authenticate();
    server = await listen();
    const address = server.address();
    const base = `http://127.0.0.1:${address.port}`;

    const live = await fetch(`${base}/health/live`, {
      headers: { "x-request-id": "runtime-health-1234" },
    });
    assert.strictEqual(live.status, 200);
    assert.strictEqual(live.headers.get("x-request-id"), "runtime-health-1234");
    const liveBody = await live.json();
    assert.strictEqual(liveBody.status, "ok");

    const ready = await fetch(`${base}/health/ready`);
    assert.strictEqual(ready.status, 200);
    const readyBody = await ready.json();
    assert.strictEqual(readyBody.status, "ready");

    console.log("✓ Health live/ready y Request ID verificados contra MySQL real de CI.");
  } finally {
    if (server) await close(server);
    await sequelize.close();
  }
};

main().catch((error) => {
  console.error(`✗ Runtime health falló: ${error.message}`);
  process.exitCode = 1;
});
