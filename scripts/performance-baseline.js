const fs = require("fs");
const path = require("path");
const { performance } = require("node:perf_hooks");
const budgets = require("../performance/budgets.json");
const { TEST_PASSWORD, TEST_USERS } = require("./integration-fixtures");

const BASE_URL = String(process.env.PERF_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const RESULTS_DIR = path.resolve(process.env.PERF_RESULTS_DIR || "performance-results");
const WARMUPS = Number.parseInt(process.env.PERF_WARMUPS || "2", 10);
const DEFAULT_SAMPLES = Number.parseInt(process.env.PERF_SAMPLES || "10", 10);

const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
};

const round = (value) => Number(value.toFixed(2));

const requestOnce = async ({ method = "GET", route, token, body }) => {
  const started = performance.now();
  const response = await fetch(`${BASE_URL}${route}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const durationMs = performance.now() - started;
  return {
    status: response.status,
    ok: response.ok,
    duration_ms: durationMs,
    bytes: Buffer.byteLength(text),
    text,
  };
};

const login = async (email) => {
  const result = await requestOnce({
    method: "POST",
    route: "/api/auth/login",
    body: { email, password: TEST_PASSWORD },
  });
  if (!result.ok) {
    throw new Error(`Login de baseline falló (${email}): HTTP ${result.status}`);
  }
  const parsed = JSON.parse(result.text);
  if (!parsed.token) throw new Error(`Login de baseline sin token (${email})`);
  return { token: parsed.token, measurement: result };
};

const classifyBudget = (metrics, budget) => {
  const targetOk = metrics.p95_ms <= budget.target_p95_ms && metrics.payload_kb <= budget.target_payload_kb;
  const hardOk = metrics.p95_ms <= budget.hard_p95_ms && metrics.payload_kb <= budget.hard_payload_kb;
  return { target: targetOk ? "pass" : "warn", hard: hardOk ? "pass" : "fail" };
};

const measureCase = async ({ name, samples = DEFAULT_SAMPLES, makeRequest }) => {
  for (let i = 0; i < WARMUPS; i += 1) await makeRequest();

  const results = [];
  for (let i = 0; i < samples; i += 1) results.push(await makeRequest());

  const errors = results.filter((item) => !item.ok);
  const durations = results.map((item) => item.duration_ms);
  const payloadBytes = Math.max(...results.map((item) => item.bytes), 0);
  const metrics = {
    samples,
    errors: errors.length,
    status_codes: [...new Set(results.map((item) => item.status))],
    avg_ms: round(durations.reduce((sum, value) => sum + value, 0) / durations.length),
    p50_ms: round(percentile(durations, 50)),
    p95_ms: round(percentile(durations, 95)),
    p99_ms: round(percentile(durations, 99)),
    max_ms: round(Math.max(...durations)),
    payload_kb: round(payloadBytes / 1024),
  };

  const budget = budgets.api[name];
  const budgetStatus = classifyBudget(metrics, budget);
  return { name, metrics, budget, budget_status: budgetStatus };
};

const main = async () => {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  const admin = await login(TEST_USERS.admin);
  const responsable = await login(TEST_USERS.responsable1);

  const cases = [
    {
      name: "health_ready",
      samples: 15,
      makeRequest: () => requestOnce({ route: "/health/ready" }),
    },
    {
      name: "login_admin",
      samples: 6,
      makeRequest: () => requestOnce({
        method: "POST",
        route: "/api/auth/login",
        body: { email: TEST_USERS.admin, password: TEST_PASSWORD },
      }),
    },
    {
      name: "auth_me_admin",
      makeRequest: () => requestOnce({ route: "/api/auth/me", token: admin.token }),
    },
    {
      name: "activos_admin",
      samples: 6,
      makeRequest: () => requestOnce({ route: "/api/activos?page=1&page_size=25", token: admin.token }),
    },
    {
      name: "activos_responsable",
      samples: 8,
      makeRequest: () => requestOnce({ route: "/api/activos?page=1&page_size=25", token: responsable.token }),
    },
    {
      name: "dashboard_admin",
      makeRequest: () => requestOnce({ route: "/api/dashboard", token: admin.token }),
    },
    {
      name: "insumos_admin",
      makeRequest: () => requestOnce({ route: "/api/insumos", token: admin.token }),
    },
  ];

  const results = [];
  for (const testCase of cases) {
    const result = await measureCase(testCase);
    results.push(result);
    const m = result.metrics;
    console.log(
      `PERF ${result.name} p50=${m.p50_ms}ms p95=${m.p95_ms}ms p99=${m.p99_ms}ms payload=${m.payload_kb}KB errors=${m.errors} target=${result.budget_status.target} hard=${result.budget_status.hard}`,
    );
  }

  const report = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    revision: process.env.GITHUB_SHA || process.env.DEPLOY_REVISION || "local",
    environment: process.env.CI ? "ci" : "local",
    node: process.version,
    base_url: BASE_URL,
    dataset: budgets.dataset,
    warmups: WARMUPS,
    default_samples: DEFAULT_SAMPLES,
    results,
  };

  const output = path.join(RESULTS_DIR, "api-baseline.json");
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`PERF_REPORT ${output}`);

  const hardFailures = results.filter(
    (item) => item.metrics.errors > 0 || item.budget_status.hard === "fail",
  );
  if (hardFailures.length > 0) {
    throw new Error(`Baseline excedió techo duro: ${hardFailures.map((item) => item.name).join(", ")}`);
  }
};

main().catch((error) => {
  console.error(`✗ Baseline P8.0 falló: ${error.message}`);
  process.exitCode = 1;
});
