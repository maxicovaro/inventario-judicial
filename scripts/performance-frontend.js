const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const budgets = require("../performance/budgets.json");

const DIST_DIR = path.resolve("inventario-frontend/dist");
const RESULTS_DIR = path.resolve(process.env.PERF_RESULTS_DIR || "performance-results");

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });

const kb = (bytes) => Number((bytes / 1024).toFixed(2));

const main = () => {
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error("No existe inventario-frontend/dist; ejecutá el build antes del baseline frontend");
  }

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const files = walk(DIST_DIR).map((file) => {
    const buffer = fs.readFileSync(file);
    return {
      file: path.relative(DIST_DIR, file).replace(/\\/g, "/"),
      ext: path.extname(file).toLowerCase(),
      raw_bytes: buffer.length,
      gzip_bytes: zlib.gzipSync(buffer, { level: 9 }).length,
    };
  });

  const sum = (predicate, field) =>
    files.filter(predicate).reduce((total, file) => total + file[field], 0);

  const jsGzip = sum((file) => file.ext === ".js", "gzip_bytes");
  const cssGzip = sum((file) => file.ext === ".css", "gzip_bytes");
  const totalGzip = files.reduce((total, file) => total + file.gzip_bytes, 0);
  const totalRaw = files.reduce((total, file) => total + file.raw_bytes, 0);
  const budget = budgets.frontend;

  const metrics = {
    files: files.length,
    js_gzip_kb: kb(jsGzip),
    css_gzip_kb: kb(cssGzip),
    total_gzip_kb: kb(totalGzip),
    total_raw_kb: kb(totalRaw),
    largest_files: [...files]
      .sort((a, b) => b.gzip_bytes - a.gzip_bytes)
      .slice(0, 10)
      .map((file) => ({ file: file.file, gzip_kb: kb(file.gzip_bytes), raw_kb: kb(file.raw_bytes) })),
  };

  const targetPass =
    metrics.js_gzip_kb <= budget.target_js_gzip_kb &&
    metrics.css_gzip_kb <= budget.target_css_gzip_kb &&
    metrics.total_gzip_kb <= budget.target_total_gzip_kb;
  const hardPass =
    metrics.js_gzip_kb <= budget.hard_js_gzip_kb &&
    metrics.css_gzip_kb <= budget.hard_css_gzip_kb &&
    metrics.total_gzip_kb <= budget.hard_total_gzip_kb;

  const report = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    revision: process.env.GITHUB_SHA || "local",
    metrics,
    budget,
    budget_status: { target: targetPass ? "pass" : "warn", hard: hardPass ? "pass" : "fail" },
  };

  fs.writeFileSync(path.join(RESULTS_DIR, "frontend-baseline.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    `PERF_FRONTEND js_gzip=${metrics.js_gzip_kb}KB css_gzip=${metrics.css_gzip_kb}KB total_gzip=${metrics.total_gzip_kb}KB target=${report.budget_status.target} hard=${report.budget_status.hard}`,
  );
  for (const file of metrics.largest_files.slice(0, 5)) {
    console.log(`PERF_FRONTEND_FILE ${file.file} gzip=${file.gzip_kb}KB raw=${file.raw_kb}KB`);
  }

  if (!hardPass) throw new Error("Bundle frontend excedió el techo duro P8.0");
};

try {
  main();
} catch (error) {
  console.error(`✗ Baseline frontend P8.0 falló: ${error.message}`);
  process.exitCode = 1;
}
