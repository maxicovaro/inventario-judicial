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
const { preparePerformanceDataset } = require("./performance-fixtures");
const {
  TEST_PASSWORD,
  TEST_USERS,
  assertSafeIntegrationDatabase,
} = require("./integration-fixtures");
const {
  round,
  normalizeSql,
  querySignature,
  queryType,
  extractTables,
} = require("./performance-profile-utils");

const RESULTS_DIR = path.resolve(process.env.PERF_RESULTS_DIR || "performance-results");
const CONCURRENCY_LEVELS = [1, 20];
const STOCK_INITIAL = 1000;

const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[index];
};

const listen = () =>
  new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
    server.once("error", reject);
  });

const close = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

const requestOnce = async (base, route, { method = "GET", token, body, idempotencyKey } = {}) => {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const started = performance.now();
  const response = await fetch(`${base}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    duration_ms: performance.now() - started,
    text,
  };
};

const login = async (base, email) => {
  const result = await requestOnce(base, "/api/auth/login", {
    method: "POST",
    body: { email, password: TEST_PASSWORD },
  });
  if (!result.ok) throw new Error(`Login P8.6 falló: HTTP ${result.status}`);
  const parsed = JSON.parse(result.text);
  if (!parsed.token) throw new Error("Login P8.6 no devolvió token");
  return parsed.token;
};

const prepareStockStage = async ({ insumoId, oficinaId }) => {
  await Promise.all([
    StockOficina.destroy({ where: { insumo_id: insumoId, oficina_id: oficinaId } }),
    MovimientoStock.destroy({ where: { insumo_id: insumoId } }),
  ]);
  await Insumo.update({ stock_actual: STOCK_INITIAL }, { where: { id: insumoId } });
};

const captureSql = async (operation) => {
  const originalLogging = sequelize.options.logging;
  const originalBenchmark = sequelize.options.benchmark;
  const queries = [];

  sequelize.options.benchmark = true;
  sequelize.options.logging = (sql, timing) => {
    const normalized = normalizeSql(sql);
    queries.push({
      signature: querySignature(sql),
      type: queryType(sql),
      normalized_sql: normalized,
      tables: extractTables(sql),
      duration_ms: Number.isFinite(timing) ? Number(timing) : 0,
      for_update: /\bFOR UPDATE\b/i.test(normalized),
    });
  };

  try {
    const value = await operation();
    return { value, queries };
  } finally {
    sequelize.options.logging = originalLogging;
    sequelize.options.benchmark = originalBenchmark;
  }
};

const aggregateQueries = (queries) => {
  const grouped = new Map();

  for (const query of queries) {
    if (!grouped.has(query.signature)) {
      grouped.set(query.signature, {
        signature: query.signature,
        type: query.type,
        normalized_sql: query.normalized_sql,
        tables: query.tables,
        for_update: query.for_update,
        executions: 0,
        total_duration_ms: 0,
        max_duration_ms: 0,
      });
    }

    const current = grouped.get(query.signature);
    current.executions += 1;
    current.total_duration_ms += query.duration_ms;
    current.max_duration_ms = Math.max(current.max_duration_ms, query.duration_ms);
  }

  return [...grouped.values()]
    .map((item) => ({
      ...item,
      total_duration_ms: round(item.total_duration_ms),
      avg_duration_ms: round(item.total_duration_ms / Math.max(1, item.executions)),
      max_duration_ms: round(item.max_duration_ms),
    }))
    .sort((a, b) => b.total_duration_ms - a.total_duration_ms);
};

const summarizeHttp = (results) => {
  const durations = results.map((item) => item.duration_ms);
  return {
    requests: results.length,
    errors: results.filter((item) => !item.ok).length,
    p50_ms: round(percentile(durations, 50)),
    p95_ms: round(percentile(durations, 95)),
    p99_ms: round(percentile(durations, 99)),
    max_ms: round(Math.max(...durations, 0)),
  };
};

const runStage = async ({ base, token, insumoId, oficinaId, concurrency }) => {
  await prepareStockStage({ insumoId, oficinaId });

  const { value: results, queries } = await captureSql(() =>
    Promise.all(
      Array.from({ length: concurrency }, (_, index) =>
        requestOnce(base, "/api/stock-oficina/asignar", {
          method: "POST",
          token,
          idempotencyKey: `p8-p6-profile-${concurrency}-${index}`,
          body: {
            insumo_id: insumoId,
            oficina_id: oficinaId,
            cantidad: 1,
            motivo: "P8.6 perfil de contención sintético",
          },
        }),
      ),
    ),
  );

  const queryGroups = aggregateQueries(queries);
  const [insumo, stock, movimientos] = await Promise.all([
    Insumo.findByPk(insumoId),
    StockOficina.findOne({ where: { insumo_id: insumoId, oficina_id: oficinaId } }),
    MovimientoStock.count({ where: { insumo_id: insumoId, tipo: "EGRESO" } }),
  ]);

  const invariantOk =
    Number(insumo.stock_actual) === STOCK_INITIAL - concurrency &&
    Number(stock?.cantidad || 0) === concurrency &&
    Number(movimientos) === concurrency;

  const lockQueries = queryGroups.filter((query) => query.for_update);
  const dominant = queryGroups.slice(0, 10);

  return {
    concurrency,
    http: summarizeHttp(results),
    query_count: queries.length,
    sql_total_ms: round(queries.reduce((sum, query) => sum + query.duration_ms, 0)),
    invariant_ok: invariantOk,
    lock_queries: lockQueries,
    top_queries: dominant,
  };
};

const main = async () => {
  assertSafeIntegrationDatabase();
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  await preparePerformanceDataset();

  let server;
  try {
    server = await listen();
    const base = `http://127.0.0.1:${server.address().port}`;
    const [token, responsable, insumo] = await Promise.all([
      login(base, TEST_USERS.admin),
      Usuario.findOne({ where: { email: TEST_USERS.responsable1 } }),
      Insumo.findOne({ where: { nombre: "Resma A4 Integración" } }),
    ]);

    if (!responsable?.oficina_id || !insumo) {
      throw new Error("No se pudieron resolver fixtures P8.6");
    }

    const stages = [];
    for (const concurrency of CONCURRENCY_LEVELS) {
      const stage = await runStage({
        base,
        token,
        insumoId: insumo.id,
        oficinaId: responsable.oficina_id,
        concurrency,
      });
      stages.push(stage);

      const hottestLock = stage.lock_queries[0];
      console.log(
        `P8_STOCK_CONTENTION c=${concurrency} p95=${stage.http.p95_ms}ms errors=${stage.http.errors} sql_total=${stage.sql_total_ms}ms lock_max=${hottestLock?.max_duration_ms || 0}ms invariant=${stage.invariant_ok}`,
      );
    }

    const c1 = stages.find((stage) => stage.concurrency === 1);
    const c20 = stages.find((stage) => stage.concurrency === 20);
    const c20Lock = c20?.lock_queries
      .filter((query) => query.tables.includes("insumos"))
      .sort((a, b) => b.total_duration_ms - a.total_duration_ms)[0] || null;

    const conclusion = {
      read_before_change: true,
      central_stock_lock_is_dominant_candidate: Boolean(
        c20Lock && c20Lock.max_duration_ms >= Math.max(10, (c1?.http.p95_ms || 0) * 2),
      ),
      production_change_required: false,
      reason:
        "Si la espera dominante está en FOR UPDATE del insumo central, la serialización protege contra doble gasto. P8.6 no debe relajar ese lock sin una alternativa que preserve las mismas invariantes.",
    };

    const report = {
      schema_version: 1,
      generated_at: new Date().toISOString(),
      revision: process.env.GITHUB_SHA || "local",
      environment: process.env.CI ? "ci" : "local-test",
      dataset: { activos: 6000, insumos: 300 },
      runner_note:
        "Los tiempos incluyen aplicación, MySQL y ruido del runner compartido; se usan para localizar contención, no como SLA.",
      stages,
      conclusion,
    };

    const output = path.join(RESULTS_DIR, "stock-contention-profile.json");
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`P8_STOCK_CONTENTION_REPORT ${output}`);

    if (stages.some((stage) => stage.http.errors > 0 || !stage.invariant_ok)) {
      throw new Error("Perfil P8.6 detectó errores HTTP o una invariante de stock inválida");
    }
  } finally {
    if (server) await close(server);
    await sequelize.close();
  }
};

main().catch((error) => {
  console.error(`✗ Perfil de contención P8.6 falló: ${error.stack || error.message}`);
  process.exitCode = 1;
});
