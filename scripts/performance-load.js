const fs = require("fs");
const path = require("path");
const { performance } = require("node:perf_hooks");
const app = require("../src/app");
const sequelize = require("../src/config/database");
const {
  Insumo,
  MovimientoStock,
  StockOficina,
  Usuario,
} = require("../src/models");
const budgets = require("../performance/budgets.json");
const { preparePerformanceDataset } = require("./performance-fixtures");
const {
  TEST_PASSWORD,
  TEST_USERS,
  assertSafeIntegrationDatabase,
} = require("./integration-fixtures");

const RESULTS_DIR = path.resolve(process.env.PERF_RESULTS_DIR || "performance-results");
const READ_LEVELS = String(process.env.P8_LOAD_LEVELS || "1,5,10,20")
  .split(",")
  .map((value) => Number.parseInt(value.trim(), 10))
  .filter((value) => Number.isInteger(value) && value > 0);
const LOGIN_LEVELS = [1, 3, 5];
const WRITE_LEVELS = [1, 5, 10, 20];
const READ_ITERATIONS = Number.parseInt(process.env.P8_LOAD_ITERATIONS || "3", 10);

const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[index];
};

const round = (value) => Number(Number(value || 0).toFixed(2));

const listen = () =>
  new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
    server.once("error", reject);
  });

const close = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

const requestOnce = async (
  base,
  route,
  { method = "GET", token, body, idempotencyKey } = {},
) => {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const started = performance.now();
  try {
    const response = await fetch(`${base}${route}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return {
      status: response.status,
      ok: response.ok,
      duration_ms: performance.now() - started,
      bytes: Buffer.byteLength(text),
      replay: response.headers.get("idempotent-replay") === "true",
      text,
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      duration_ms: performance.now() - started,
      bytes: 0,
      replay: false,
      network_error: error.message,
      text: "",
    };
  }
};

const summarize = (results, elapsedMs) => {
  const durations = results.map((item) => item.duration_ms);
  const errors = results.filter((item) => !item.ok);
  const requests = results.length;
  return {
    requests,
    errors: errors.length,
    error_rate_pct: round((errors.length / Math.max(1, requests)) * 100),
    status_codes: [...new Set(results.map((item) => item.status))].sort((a, b) => a - b),
    avg_ms: round(durations.reduce((sum, value) => sum + value, 0) / Math.max(1, durations.length)),
    p50_ms: round(percentile(durations, 50)),
    p95_ms: round(percentile(durations, 95)),
    p99_ms: round(percentile(durations, 99)),
    max_ms: round(Math.max(...durations, 0)),
    throughput_rps: round(requests / Math.max(0.001, elapsedMs / 1000)),
    payload_max_kb: round(Math.max(...results.map((item) => item.bytes), 0) / 1024),
  };
};

const classify = (metrics, budget) => {
  const target =
    metrics.p95_ms <= budget.target_p95_ms &&
    metrics.error_rate_pct <= budget.target_error_rate_pct;
  const hard =
    metrics.p95_ms <= budget.hard_p95_ms &&
    metrics.error_rate_pct <= budget.hard_error_rate_pct;
  return {
    target: target ? "pass" : "warn",
    hard: hard ? "pass" : "fail",
  };
};

const runWorkers = async ({ concurrency, iterations, makeRequest }) => {
  const started = performance.now();
  const workers = Array.from({ length: concurrency }, (_, workerIndex) =>
    (async () => {
      const own = [];
      for (let iteration = 0; iteration < iterations; iteration += 1) {
        own.push(await makeRequest({ workerIndex, iteration }));
      }
      return own;
    })(),
  );
  const nested = await Promise.all(workers);
  return {
    results: nested.flat(),
    elapsed_ms: performance.now() - started,
  };
};

const runHttpScenario = async ({
  name,
  levels = READ_LEVELS,
  iterations = READ_ITERATIONS,
  makeRequest,
}) => {
  const budget = budgets.load[name];
  if (!budget) throw new Error(`Falta presupuesto de carga para ${name}`);

  const stages = [];
  let baselineP95 = null;

  for (const concurrency of levels) {
    const run = await runWorkers({ concurrency, iterations, makeRequest });
    const metrics = summarize(run.results, run.elapsed_ms);
    if (baselineP95 === null) baselineP95 = Math.max(metrics.p95_ms, 0.01);
    metrics.p95_vs_c1 = round(metrics.p95_ms / baselineP95);
    metrics.degraded =
      metrics.p95_ms > budget.target_p95_ms && metrics.p95_vs_c1 >= 2;

    const budgetStatus = classify(metrics, budget);
    stages.push({ concurrency, metrics, budget_status: budgetStatus });
    console.log(
      `P8_LOAD ${name} c=${concurrency} requests=${metrics.requests} p50=${metrics.p50_ms}ms p95=${metrics.p95_ms}ms p99=${metrics.p99_ms}ms rps=${metrics.throughput_rps} errors=${metrics.errors} target=${budgetStatus.target} hard=${budgetStatus.hard}`,
    );
  }

  const firstDegradation = stages.find((stage) => stage.metrics.degraded)?.concurrency || null;
  return { name, budget, first_degradation_concurrency: firstDegradation, stages };
};

const login = async (base, email) => {
  const result = await requestOnce(base, "/api/auth/login", {
    method: "POST",
    body: { email, password: TEST_PASSWORD },
  });
  if (!result.ok) {
    throw new Error(`Login P8.5 falló (${email}): HTTP ${result.status}`);
  }
  const parsed = JSON.parse(result.text);
  if (!parsed.token) throw new Error(`Login P8.5 sin token (${email})`);
  return parsed.token;
};

const prepareStockStage = async ({ insumoId, oficinaId, stockInicial }) => {
  await Promise.all([
    StockOficina.destroy({ where: { insumo_id: insumoId, oficina_id: oficinaId } }),
    MovimientoStock.destroy({ where: { insumo_id: insumoId } }),
  ]);
  await Insumo.update({ stock_actual: stockInicial }, { where: { id: insumoId } });
};

const runStockUniqueScenario = async ({ base, token, insumoId, oficinaId }) => {
  const name = "stock_write_unique";
  const budget = budgets.load[name];
  const stages = [];
  let baselineP95 = null;

  for (const concurrency of WRITE_LEVELS) {
    const stockInicial = 1000;
    await prepareStockStage({ insumoId, oficinaId, stockInicial });

    const started = performance.now();
    const results = await Promise.all(
      Array.from({ length: concurrency }, (_, index) =>
        requestOnce(base, "/api/stock-oficina/asignar", {
          method: "POST",
          token,
          idempotencyKey: `p8-load-stock-unique-${concurrency}-${index}`,
          body: {
            insumo_id: insumoId,
            oficina_id: oficinaId,
            cantidad: 1,
            motivo: "P8.5 carga transaccional sintética",
          },
        }),
      ),
    );
    const metrics = summarize(results, performance.now() - started);
    if (baselineP95 === null) baselineP95 = Math.max(metrics.p95_ms, 0.01);
    metrics.p95_vs_c1 = round(metrics.p95_ms / baselineP95);
    metrics.degraded =
      metrics.p95_ms > budget.target_p95_ms && metrics.p95_vs_c1 >= 2;

    const [insumo, stock, movimientos] = await Promise.all([
      Insumo.findByPk(insumoId),
      StockOficina.findOne({ where: { insumo_id: insumoId, oficina_id: oficinaId } }),
      MovimientoStock.count({ where: { insumo_id: insumoId, tipo: "EGRESO" } }),
    ]);
    metrics.invariant_ok =
      Number(insumo.stock_actual) === stockInicial - concurrency &&
      Number(stock?.cantidad || 0) === concurrency &&
      Number(movimientos) === concurrency;

    const budgetStatus = classify(metrics, budget);
    if (!metrics.invariant_ok) budgetStatus.hard = "fail";
    stages.push({ concurrency, metrics, budget_status: budgetStatus });
    console.log(
      `P8_LOAD ${name} c=${concurrency} p95=${metrics.p95_ms}ms rps=${metrics.throughput_rps} errors=${metrics.errors} invariant=${metrics.invariant_ok} target=${budgetStatus.target} hard=${budgetStatus.hard}`,
    );
  }

  return {
    name,
    budget,
    first_degradation_concurrency:
      stages.find((stage) => stage.metrics.degraded)?.concurrency || null,
    stages,
  };
};

const runStockIdempotentScenario = async ({ base, token, insumoId, oficinaId }) => {
  const name = "stock_write_idempotent";
  const budget = budgets.load[name];
  const stages = [];
  let baselineP95 = null;

  for (const logicalConcurrency of [1, 5, 10]) {
    const stockInicial = 1000;
    await prepareStockStage({ insumoId, oficinaId, stockInicial });

    const started = performance.now();
    const pairs = await Promise.all(
      Array.from({ length: logicalConcurrency }, async (_, index) => {
        const key = `p8-load-stock-idem-${logicalConcurrency}-${index}`;
        const body = {
          insumo_id: insumoId,
          oficina_id: oficinaId,
          cantidad: 1,
          motivo: "P8.5 replay idempotente sintético",
        };
        return Promise.all([
          requestOnce(base, "/api/stock-oficina/asignar", {
            method: "POST",
            token,
            idempotencyKey: key,
            body,
          }),
          requestOnce(base, "/api/stock-oficina/asignar", {
            method: "POST",
            token,
            idempotencyKey: key,
            body,
          }),
        ]);
      }),
    );
    const results = pairs.flat();
    const metrics = summarize(results, performance.now() - started);
    if (baselineP95 === null) baselineP95 = Math.max(metrics.p95_ms, 0.01);
    metrics.p95_vs_c1 = round(metrics.p95_ms / baselineP95);
    metrics.logical_operations = logicalConcurrency;
    metrics.logical_ops_per_sec = round(
      logicalConcurrency / Math.max(0.001, (performance.now() - started) / 1000),
    );
    metrics.replays = results.filter((item) => item.replay).length;
    metrics.degraded =
      metrics.p95_ms > budget.target_p95_ms && metrics.p95_vs_c1 >= 2;

    const [insumo, stock, movimientos] = await Promise.all([
      Insumo.findByPk(insumoId),
      StockOficina.findOne({ where: { insumo_id: insumoId, oficina_id: oficinaId } }),
      MovimientoStock.count({ where: { insumo_id: insumoId, tipo: "EGRESO" } }),
    ]);
    metrics.invariant_ok =
      Number(insumo.stock_actual) === stockInicial - logicalConcurrency &&
      Number(stock?.cantidad || 0) === logicalConcurrency &&
      Number(movimientos) === logicalConcurrency &&
      metrics.replays === logicalConcurrency;

    const budgetStatus = classify(metrics, budget);
    if (!metrics.invariant_ok) budgetStatus.hard = "fail";
    stages.push({ concurrency: logicalConcurrency * 2, metrics, budget_status: budgetStatus });
    console.log(
      `P8_LOAD ${name} logical=${logicalConcurrency} http=${logicalConcurrency * 2} p95=${metrics.p95_ms}ms replays=${metrics.replays} invariant=${metrics.invariant_ok} target=${budgetStatus.target} hard=${budgetStatus.hard}`,
    );
  }

  return {
    name,
    budget,
    first_degradation_concurrency:
      stages.find((stage) => stage.metrics.degraded)?.concurrency || null,
    stages,
  };
};

const main = async () => {
  assertSafeIntegrationDatabase();
  if (!READ_LEVELS.length) throw new Error("P8_LOAD_LEVELS no contiene concurrencias válidas");
  if (!Number.isInteger(READ_ITERATIONS) || READ_ITERATIONS <= 0) {
    throw new Error("P8_LOAD_ITERATIONS debe ser un entero positivo");
  }

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  await preparePerformanceDataset();

  let server;
  try {
    server = await listen();
    const base = `http://127.0.0.1:${server.address().port}`;
    const [adminToken, responsableToken, responsable] = await Promise.all([
      login(base, TEST_USERS.admin),
      login(base, TEST_USERS.responsable1),
      Usuario.findOne({ where: { email: TEST_USERS.responsable1 } }),
    ]);
    const insumo = await Insumo.findOne({
      where: { nombre: "Resma A4 Integración" },
    });
    if (!responsable?.oficina_id || !insumo) {
      throw new Error("No se pudieron resolver fixtures seguros para P8.5");
    }

    const scenarios = [];

    scenarios.push(
      await runHttpScenario({
        name: "auth_me_admin",
        makeRequest: () => requestOnce(base, "/api/auth/me", { token: adminToken }),
      }),
    );
    scenarios.push(
      await runHttpScenario({
        name: "dashboard_admin",
        makeRequest: () => requestOnce(base, "/api/dashboard", { token: adminToken }),
      }),
    );
    scenarios.push(
      await runHttpScenario({
        name: "activos_admin",
        makeRequest: () =>
          requestOnce(base, "/api/activos?page=1&page_size=25", { token: adminToken }),
      }),
    );
    scenarios.push(
      await runHttpScenario({
        name: "pedidos_responsable",
        makeRequest: () => requestOnce(base, "/api/pedidos", { token: responsableToken }),
      }),
    );
    scenarios.push(
      await runHttpScenario({
        name: "stock_responsable",
        makeRequest: () =>
          requestOnce(base, `/api/stock-oficina/${responsable.oficina_id}`, {
            token: responsableToken,
          }),
      }),
    );

    const mixedRoutes = [
      () => requestOnce(base, "/api/auth/me", { token: adminToken }),
      () => requestOnce(base, "/api/dashboard", { token: adminToken }),
      () => requestOnce(base, "/api/activos?page=1&page_size=25", { token: adminToken }),
      () => requestOnce(base, "/api/activos?page=2&page_size=25", { token: adminToken }),
      () => requestOnce(base, "/api/activos/catalogo?limit=50", { token: adminToken }),
      () => requestOnce(base, "/api/insumos", { token: adminToken }),
      () => requestOnce(base, "/api/pedidos", { token: responsableToken }),
      () =>
        requestOnce(base, `/api/stock-oficina/${responsable.oficina_id}`, {
          token: responsableToken,
        }),
    ];
    scenarios.push(
      await runHttpScenario({
        name: "operational_read_mix",
        iterations: 4,
        makeRequest: ({ workerIndex, iteration }) =>
          mixedRoutes[(workerIndex + iteration) % mixedRoutes.length](),
      }),
    );

    scenarios.push(
      await runHttpScenario({
        name: "login_success",
        levels: LOGIN_LEVELS,
        iterations: 1,
        makeRequest: () =>
          requestOnce(base, "/api/auth/login", {
            method: "POST",
            body: { email: TEST_USERS.responsable2, password: TEST_PASSWORD },
          }),
      }),
    );

    scenarios.push(
      await runStockUniqueScenario({
        base,
        token: adminToken,
        insumoId: insumo.id,
        oficinaId: responsable.oficina_id,
      }),
    );
    scenarios.push(
      await runStockIdempotentScenario({
        base,
        token: adminToken,
        insumoId: insumo.id,
        oficinaId: responsable.oficina_id,
      }),
    );

    const hardFailures = scenarios.flatMap((scenario) =>
      scenario.stages
        .filter((stage) => stage.budget_status.hard === "fail")
        .map((stage) => `${scenario.name}@${stage.concurrency}`),
    );

    const report = {
      schema_version: 1,
      generated_at: new Date().toISOString(),
      revision: process.env.GITHUB_SHA || "local",
      environment: process.env.CI ? "ci" : "local-test",
      runner_note:
        "Las cifras reflejan aplicación + MySQL + límites del runner compartido. No constituyen SLA de producción.",
      dataset: budgets.dataset,
      read_levels: READ_LEVELS,
      read_iterations_per_worker: READ_ITERATIONS,
      scenarios,
      hard_failures: hardFailures,
    };

    const output = path.join(RESULTS_DIR, "load-profile.json");
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`P8_LOAD_REPORT ${output}`);

    if (hardFailures.length) {
      throw new Error(`Carga P8.5 excedió techo duro: ${hardFailures.join(", ")}`);
    }
  } finally {
    if (server) await close(server);
    await sequelize.close();
  }
};

main().catch((error) => {
  console.error(`✗ Pruebas de carga P8.5 fallaron: ${error.stack || error.message}`);
  process.exitCode = 1;
});
