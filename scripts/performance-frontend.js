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

const getAttribute = (tag, attribute) => {
  const match = tag.match(new RegExp(`\\b${attribute}=(['"])(.*?)\\1`, "i"));
  return match?.[2] || null;
};

const normalizeAssetReference = (reference) => {
  if (!reference || /^(?:https?:)?\/\//i.test(reference)) return null;
  return reference.replace(/^\.\//, "").replace(/^\/+/, "");
};

const getInitialAssetReferences = (html) => {
  const assets = new Set();
  const tags = html.match(/<(?:script|link)\b[^>]*>/gi) || [];

  for (const tag of tags) {
    if (/^<script\b/i.test(tag)) {
      const src = normalizeAssetReference(getAttribute(tag, "src"));
      if (src) assets.add(src);
      continue;
    }

    const rel = (getAttribute(tag, "rel") || "").toLowerCase();
    if (!rel.split(/\s+/).some((value) => ["modulepreload", "stylesheet"].includes(value))) {
      continue;
    }

    const href = normalizeAssetReference(getAttribute(tag, "href"));
    if (href) assets.add(href);
  }

  return [...assets];
};

const main = () => {
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error("No existe inventario-frontend/dist; ejecutá el build antes del baseline frontend");
  }

  const indexPath = path.join(DIST_DIR, "index.html");
  if (!fs.existsSync(indexPath)) {
    throw new Error("No existe inventario-frontend/dist/index.html");
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

  const initialReferences = getInitialAssetReferences(fs.readFileSync(indexPath, "utf8"));
  const initialReferenceSet = new Set(initialReferences);
  const initialFiles = files.filter((file) => initialReferenceSet.has(file.file));
  const fontExtensions = new Set([".woff", ".woff2", ".ttf", ".otf"]);

  const jsGzip = sum((file) => file.ext === ".js", "gzip_bytes");
  const cssGzip = sum((file) => file.ext === ".css", "gzip_bytes");
  const fontGzip = sum((file) => fontExtensions.has(file.ext), "gzip_bytes");
  const totalGzip = files.reduce((total, file) => total + file.gzip_bytes, 0);
  const totalRaw = files.reduce((total, file) => total + file.raw_bytes, 0);
  const initialJsGzip = initialFiles
    .filter((file) => file.ext === ".js")
    .reduce((total, file) => total + file.gzip_bytes, 0);
  const initialCssGzip = initialFiles
    .filter((file) => file.ext === ".css")
    .reduce((total, file) => total + file.gzip_bytes, 0);
  const initialTotalGzip = initialFiles.reduce((total, file) => total + file.gzip_bytes, 0);
  const budget = budgets.frontend;

  const metrics = {
    files: files.length,
    js_chunks: files.filter((file) => file.ext === ".js").length,
    font_files: files.filter((file) => fontExtensions.has(file.ext)).length,
    js_gzip_kb: kb(jsGzip),
    css_gzip_kb: kb(cssGzip),
    font_gzip_kb: kb(fontGzip),
    total_gzip_kb: kb(totalGzip),
    total_raw_kb: kb(totalRaw),
    initial_js_gzip_kb: kb(initialJsGzip),
    initial_css_gzip_kb: kb(initialCssGzip),
    initial_total_gzip_kb: kb(initialTotalGzip),
    initial_assets: initialReferences,
    largest_files: [...files]
      .sort((a, b) => b.gzip_bytes - a.gzip_bytes)
      .slice(0, 10)
      .map((file) => ({ file: file.file, gzip_kb: kb(file.gzip_bytes), raw_kb: kb(file.raw_bytes) })),
  };

  const targetPass =
    metrics.js_gzip_kb <= budget.target_js_gzip_kb &&
    metrics.css_gzip_kb <= budget.target_css_gzip_kb &&
    metrics.total_gzip_kb <= budget.target_total_gzip_kb &&
    metrics.initial_js_gzip_kb <= budget.target_initial_js_gzip_kb &&
    metrics.font_gzip_kb <= budget.target_font_gzip_kb;
  const hardPass =
    metrics.js_gzip_kb <= budget.hard_js_gzip_kb &&
    metrics.css_gzip_kb <= budget.hard_css_gzip_kb &&
    metrics.total_gzip_kb <= budget.hard_total_gzip_kb &&
    metrics.initial_js_gzip_kb <= budget.hard_initial_js_gzip_kb &&
    metrics.font_gzip_kb <= budget.hard_font_gzip_kb;

  const report = {
    schema_version: 2,
    generated_at: new Date().toISOString(),
    revision: process.env.GITHUB_SHA || "local",
    metrics,
    budget,
    budget_status: { target: targetPass ? "pass" : "warn", hard: hardPass ? "pass" : "fail" },
  };

  fs.writeFileSync(path.join(RESULTS_DIR, "frontend-baseline.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    `PERF_FRONTEND js_gzip=${metrics.js_gzip_kb}KB initial_js_gzip=${metrics.initial_js_gzip_kb}KB css_gzip=${metrics.css_gzip_kb}KB fonts_gzip=${metrics.font_gzip_kb}KB total_gzip=${metrics.total_gzip_kb}KB target=${report.budget_status.target} hard=${report.budget_status.hard}`,
  );
  console.log(
    `PERF_FRONTEND_INITIAL chunks=${metrics.js_chunks} assets=${metrics.initial_assets.length} initial_total_gzip=${metrics.initial_total_gzip_kb}KB`,
  );
  for (const file of metrics.largest_files.slice(0, 5)) {
    console.log(`PERF_FRONTEND_FILE ${file.file} gzip=${file.gzip_kb}KB raw=${file.raw_kb}KB`);
  }

  if (!hardPass) throw new Error("Bundle frontend excedió el techo duro P8");
};

try {
  main();
} catch (error) {
  console.error(`✗ Baseline frontend P8 falló: ${error.message}`);
  process.exitCode = 1;
}
