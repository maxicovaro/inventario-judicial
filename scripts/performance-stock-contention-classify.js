const fs = require("fs");
const path = require("path");

const RESULTS_DIR = path.resolve(process.env.PERF_RESULTS_DIR || "performance-results");
const REPORT_PATH = path.join(RESULTS_DIR, "stock-contention-profile.json");

const round = (value) =>
  Number.isFinite(value) ? Number(value.toFixed(2)) : null;

const centralLock = (stage) =>
  stage?.lock_queries
    ?.filter((query) => Array.isArray(query.tables) && query.tables.includes("insumos"))
    .sort((a, b) => Number(b.total_duration_ms || 0) - Number(a.total_duration_ms || 0))[0] || null;

if (!fs.existsSync(REPORT_PATH)) {
  throw new Error(`No existe el artifact P8.6 esperado: ${REPORT_PATH}`);
}

const report = JSON.parse(fs.readFileSync(REPORT_PATH, "utf8"));
const c1 = report.stages?.find((stage) => Number(stage.concurrency) === 1);
const c20 = report.stages?.find((stage) => Number(stage.concurrency) === 20);

if (!c1 || !c20) {
  throw new Error("El perfil P8.6 debe contener etapas c1 y c20");
}

if (!c1.invariant_ok || !c20.invariant_ok || c1.http?.errors || c20.http?.errors) {
  throw new Error("No se puede clasificar P8.6 con errores HTTP o invariantes inválidas");
}

const c1Central = centralLock(c1);
const c20Central = centralLock(c20);
const sqlTotal = Number(c20.sql_total_ms || 0);
const centralTotal = Number(c20Central?.total_duration_ms || 0);
const sqlSharePct = sqlTotal > 0 ? (centralTotal / sqlTotal) * 100 : 0;
const c1Avg = Math.max(Number(c1Central?.avg_duration_ms || 0), 0.01);
const c20Avg = Number(c20Central?.avg_duration_ms || 0);
const avgWaitMultiplier = c20Avg / c1Avg;
const c1P95 = Math.max(Number(c1.http?.p95_ms || 0), 0.01);
const c20P95 = Number(c20.http?.p95_ms || 0);
const httpP95Multiplier = c20P95 / c1P95;

const dominantCandidate = Boolean(
  c20Central &&
    sqlSharePct >= 50 &&
    avgWaitMultiplier >= 5 &&
    httpP95Multiplier >= 2,
);

report.conclusion = {
  read_before_change: true,
  central_stock_lock_sql_share_pct: round(sqlSharePct),
  central_stock_lock_avg_wait_multiplier: round(avgWaitMultiplier),
  http_p95_multiplier_c20_vs_c1: round(httpP95Multiplier),
  central_stock_lock_is_dominant_candidate: dominantCandidate,
  production_change_required: false,
  decision: "preserve_consistency_locks_and_regression_guards",
  reason: dominantCandidate
    ? "El lock FOR UPDATE del insumo central concentra la mayor parte del tiempo SQL bajo c20 y su espera crece de forma marcada respecto de c1. Esa serialización protege contra doble gasto; no se relaja sin una alternativa que demuestre las mismas invariantes y una mejora repetible."
    : "El perfil no demuestra una optimización productiva segura y material. Se conservan locks, idempotencia y contratos de regresión hasta contar con evidencia más fuerte.",
};

fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  `P8_STOCK_CONTENTION_CLASSIFY share=${report.conclusion.central_stock_lock_sql_share_pct}% avg_wait_x=${report.conclusion.central_stock_lock_avg_wait_multiplier} http_p95_x=${report.conclusion.http_p95_multiplier_c20_vs_c1} dominant=${report.conclusion.central_stock_lock_is_dominant_candidate}`,
);
