const fs = require("fs");
const path = require("path");
const { performance } = require("node:perf_hooks");
const { QueryTypes } = require("sequelize");
const sequelize = require("../src/config/database");
require("../src/models");
const app = require("../src/app");
const { Activo, Insumo } = require("../src/models");
const budgets = require("../performance/budgets.json");
const { TEST_PASSWORD, TEST_USERS } = require("./integration-fixtures");
const {
  round,
  stripSequelizePrefix,
  normalizeSql,
  queryType,
  querySignature,
  extractTables,
  summarizeExplainRows,
  explainFlags,
  aggregateScenario,
} = require("./performance-profile-utils");

const RESULTS_DIR = path.resolve(process.env.PERF_RESULTS_DIR || "performance-results");
const WARMUPS = Number.parseInt(process.env.PERF_PROFILE_WARMUPS || "1", 10);
const SAMPLES = Number.parseInt(process.env.PERF_PROFILE_SAMPLES || "3", 10);
const EXPLAIN_LIMIT = Number.parseInt(process.env.PERF_PROFILE_EXPLAIN_LIMIT || "16", 10);

let activeSample = null;
let baseUrl = "";

const assertPositiveInt = (name, value) => {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} debe ser un entero positivo`);
};

assertPositiveInt("PERF_PROFILE_SAMPLES", SAMPLES);
assertPositiveInt("PERF_PROFILE_EXPLAIN_LIMIT", EXPLAIN_LIMIT);
if (!Number.isInteger(WARMUPS) || WARMUPS < 0) {
  throw new Error("PERF_PROFILE_WARMUPS debe ser un entero mayor o igual a cero");
}

const queryLogger = (sql, timing) => {
  if (!activeSample) return;
  const rawSql = stripSequelizePrefix(sql);
  if (!rawSql) return;
  const normalized = normalizeSql(rawSql);
  activeSample.queries.push({
    raw_sql: rawSql,
    normalized_sql: normalized,
    signature: querySignature(normalized),
    type: queryType(normalized),
    duration_ms: Number.isFinite(Number(timing)) ? Number(timing) : null,
    tables: extractTables(rawSql),
  });
};

const requestOnce = async ({ method = "GET", route, token, body }) => {
  const started = performance.now();
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return {
    status: response.status,
    ok: response.ok,
    http_ms: performance.now() - started,
    bytes: Buffer.byteLength(text),
    text,
  };
};

const loginToken = async (email) => {
  const response = await requestOnce({
    method: "POST",
    route: "/api/auth/login",
    body: { email, password: TEST_PASSWORD },
  });
  if (!response.ok) throw new Error(`Login de perfilado falló (${email}): HTTP ${response.status}`);
  const parsed = JSON.parse(response.text);
  if (!parsed.token) throw new Error(`Login de perfilado sin token (${email})`);
  return parsed.token;
};

const profileCase = async ({ name, makeRequest }) => {
  for (let i = 0; i < WARMUPS; i += 1) {
    const warmup = await makeRequest();
    if (!warmup.ok) throw new Error(`Warmup ${name} falló: HTTP ${warmup.status}`);
  }
  const samples = [];
  for (let index = 0; index < SAMPLES; index += 1) {
    const sample = { index: index + 1, queries: [] };
    activeSample = sample;
    let response;
    try {
      response = await makeRequest();
    } finally {
      activeSample = null;
    }
    sample.status = response.status;
    sample.http_ms = response.http_ms;
    sample.bytes = response.bytes;
    samples.push(sample);
  }
  const aggregate = aggregateScenario(name, samples);
  const top = aggregate.queries[0];
  console.log(
    `PROFILE ${name} queries=${aggregate.query_count.avg} http=${aggregate.http_ms.avg}ms top=${top ? `${top.signature}:${top.total_duration_ms}ms` : "none"} repeated=${aggregate.repeated_query_candidates.length}`,
  );
  return aggregate;
};

const collectGlobalQueries = (scenarios) => {
  const map = new Map();
  for (const scenario of scenarios) {
    for (const query of scenario.queries) {
      if (!map.has(query.signature)) {
        map.set(query.signature, {
          signature: query.signature,
          type: query.type,
          normalized_sql: query.normalized_sql,
          tables: query.tables,
          executions: 0,
          total_duration_ms: 0,
          max_duration_ms: 0,
          scenarios: new Set(),
          raw_sql: query._raw_sql,
        });
      }
      const item = map.get(query.signature);
      item.executions += query.executions;
      item.total_duration_ms += Number(query.total_duration_ms || 0);
      item.max_duration_ms = Math.max(item.max_duration_ms, Number(query.max_duration_ms || 0));
      item.scenarios.add(scenario.name);
      if (!item.raw_sql && query._raw_sql) item.raw_sql = query._raw_sql;
    }
  }
  return [...map.values()]
    .map((item) => ({
      ...item,
      scenarios: [...item.scenarios].sort(),
      total_duration_ms: round(item.total_duration_ms),
      max_duration_ms: round(item.max_duration_ms),
    }))
    .sort((a, b) => (b.total_duration_ms || 0) - (a.total_duration_ms || 0));
};

const explainDominantQueries = async (globalQueries) => {
  const candidates = globalQueries
    .filter((query) => query.type === "SELECT" && query.raw_sql)
    .slice(0, EXPLAIN_LIMIT);
  const explained = [];
  for (const query of candidates) {
    try {
      const rows = await sequelize.query(`EXPLAIN ${query.raw_sql}`, {
        type: QueryTypes.SELECT,
        logging: false,
      });
      const plan = summarizeExplainRows(rows);
      explained.push({
        signature: query.signature,
        scenarios: query.scenarios,
        normalized_sql: query.normalized_sql,
        executions: query.executions,
        total_duration_ms: query.total_duration_ms,
        max_duration_ms: query.max_duration_ms,
        plan,
        flags: explainFlags(plan),
      });
    } catch (error) {
      explained.push({
        signature: query.signature,
        scenarios: query.scenarios,
        normalized_sql: query.normalized_sql,
        executions: query.executions,
        total_duration_ms: query.total_duration_ms,
        max_duration_ms: query.max_duration_ms,
        plan: [],
        flags: ["explain_failed"],
        error: error.message,
      });
    }
  }
  return explained;
};

const collectSchemaStats = async (globalQueries) => {
  const tables = [...new Set(globalQueries.flatMap((query) => query.tables || []))]
    .filter((table) => /^[A-Za-z0-9_]+$/.test(table))
    .sort();
  if (tables.length === 0) return { tables: [], indexes: [] };
  const quoted = tables.map((table) => sequelize.escape(table)).join(", ");
  const tableRows = await sequelize.query(
    `SELECT TABLE_NAME, TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${quoted})
      ORDER BY TABLE_NAME`,
    { type: QueryTypes.SELECT, logging: false },
  );
  const indexRows = await sequelize.query(
    `SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME, CARDINALITY
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${quoted})
      ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`,
    { type: QueryTypes.SELECT, logging: false },
  );
  const byTable = new Map(tableRows.map((row) => [row.TABLE_NAME, Math.max(0, Number(row.TABLE_ROWS || 0))]));
  return {
    tables: tableRows.map((row) => ({
      table: row.TABLE_NAME,
      estimated_rows: Number(row.TABLE_ROWS || 0),
      data_kb: round(Number(row.DATA_LENGTH || 0) / 1024),
      index_kb: round(Number(row.INDEX_LENGTH || 0) / 1024),
    })),
    indexes: indexRows.map((row) => {
      const rows = byTable.get(row.TABLE_NAME) || 0;
      const cardinality = Number(row.CARDINALITY || 0);
      return {
        table: row.TABLE_NAME,
        index: row.INDEX_NAME,
        unique: Number(row.NON_UNIQUE) === 0,
        position: Number(row.SEQ_IN_INDEX),
        column: row.COLUMN_NAME,
        cardinality,
        selectivity_hint: rows > 0 ? round(cardinality / rows, 4) : null,
      };
    }),
  };
};

const removePrivateRawSql = (scenario) => ({
  ...scenario,
  queries: scenario.queries.map(({ _raw_sql, ...query }) => query),
});

const closeServer = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeIdleConnections?.();
  });

const main = async () => {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const [activos, insumos] = await Promise.all([Activo.count(), Insumo.count()]);
  if (activos < budgets.dataset.activos || insumos < budgets.dataset.insumos) {
    throw new Error(
      `Dataset insuficiente para P8.1: activos=${activos}/${budgets.dataset.activos}, insumos=${insumos}/${budgets.dataset.insumos}. Ejecutá npm run perf:fixtures.`,
    );
  }

  sequelize.options.benchmark = true;
  sequelize.options.logging = queryLogger;
  await sequelize.authenticate({ logging: false });

  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    instance.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const adminToken = await loginToken(TEST_USERS.admin);
    const responsableToken = await loginToken(TEST_USERS.responsable1);
    const definitions = [
      { name: "health_ready", makeRequest: () => requestOnce({ route: "/health/ready" }) },
      {
        name: "login_admin",
        makeRequest: () => requestOnce({
          method: "POST",
          route: "/api/auth/login",
          body: { email: TEST_USERS.admin, password: TEST_PASSWORD },
        }),
      },
      { name: "auth_me_admin", makeRequest: () => requestOnce({ route: "/api/auth/me", token: adminToken }) },
      {
        name: "activos_admin",
        makeRequest: () => requestOnce({ route: "/api/activos?page=1&page_size=25", token: adminToken }),
      },
      {
        name: "activos_responsable",
        makeRequest: () => requestOnce({ route: "/api/activos?page=1&page_size=25", token: responsableToken }),
      },
      { name: "dashboard_admin", makeRequest: () => requestOnce({ route: "/api/dashboard", token: adminToken }) },
      { name: "insumos_admin", makeRequest: () => requestOnce({ route: "/api/insumos", token: adminToken }) },
    ];

    const scenariosWithRaw = [];
    for (const definition of definitions) scenariosWithRaw.push(await profileCase(definition));

    const errors = scenariosWithRaw.filter((scenario) => scenario.errors > 0);
    if (errors.length > 0) {
      throw new Error(`Perfilado HTTP falló: ${errors.map((scenario) => scenario.name).join(", ")}`);
    }

    const globalQueries = collectGlobalQueries(scenariosWithRaw);
    const explain = await explainDominantQueries(globalQueries);
    const schema = await collectSchemaStats(globalQueries);
    const explainedOk = explain.filter((item) => item.plan.length > 0);
    if (explainedOk.length === 0) throw new Error("P8.1 no pudo capturar ningún plan EXPLAIN válido");

    const repeatedCandidates = scenariosWithRaw.flatMap((scenario) =>
      scenario.repeated_query_candidates.map((query) => ({ scenario: scenario.name, ...query })),
    );

    const report = {
      schema_version: 1,
      generated_at: new Date().toISOString(),
      revision: process.env.GITHUB_SHA || process.env.DEPLOY_REVISION || "local",
      environment: process.env.CI ? "ci" : "local",
      node: process.version,
      mysql: "8.x",
      dataset: { activos, insumos },
      methodology: {
        warmups: WARMUPS,
        samples: SAMPLES,
        sequelize_benchmark: true,
        sql_literals_persisted: false,
        explain_limit: EXPLAIN_LIMIT,
        note: "sql_total_ms suma duraciones y puede superar http_ms cuando Promise.all ejecuta queries en paralelo",
      },
      scenarios: scenariosWithRaw.map(removePrivateRawSql),
      repeated_query_candidates: repeatedCandidates,
      explain,
      schema,
    };

    const output = path.join(RESULTS_DIR, "backend-profile.json");
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(
      `PROFILE_REPORT ${output} scenarios=${report.scenarios.length} explained=${explainedOk.length} repeated=${repeatedCandidates.length}`,
    );
  } finally {
    activeSample = null;
    await closeServer(server);
    sequelize.options.logging = false;
    sequelize.options.benchmark = false;
    await sequelize.close();
  }
};

main().catch((error) => {
  console.error(`✗ Perfilado P8.1 falló: ${error.message}`);
  process.exitCode = 1;
});
