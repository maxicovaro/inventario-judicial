const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts", "staging-free-budget.js");
const example = path.join(root, "pilot", "staging-free-budget.example.json");

const run = (args) =>
  spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
  });

const pass = run(["--evidence", example]);
if (pass.status !== 0) {
  throw new Error(
    `H1 ejemplo esperado PASS falló: ${pass.stderr || pass.stdout}`,
  );
}
const report = JSON.parse(pass.stdout);
if (report.status !== "PASS") {
  throw new Error("H1 ejemplo no terminó en PASS");
}
if (!(report.totals.continuous_monthly_usd > 5)) {
  throw new Error("H1 debe demostrar que 24/7 supera ampliamente Free");
}
if (!(report.totals.projected_monthly_usd < 1)) {
  throw new Error("H1 debe demostrar que el patrón Serverless cabe en Free");
}
if (!(report.totals.max_uniform_active_hours_per_day > 3)) {
  throw new Error("H1 debe calcular margen operativo diario");
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "inventario-h1-"));
try {
  const overBudget = JSON.parse(fs.readFileSync(example, "utf8"));
  for (const service of overBudget.services) {
    service.projected_active_hours_per_day = 24;
  }
  const overFile = path.join(tmp, "over-budget.json");
  fs.writeFileSync(overFile, JSON.stringify(overBudget), "utf8");

  const blocked = run(["--evidence", overFile]);
  if (blocked.status !== 2) {
    throw new Error(
      `H1 debe devolver exit 2 cuando supera presupuesto; status=${blocked.status}`,
    );
  }
  const blockedReport = JSON.parse(blocked.stdout);
  if (blockedReport.status !== "OVER_BUDGET") {
    throw new Error("H1 no clasificó correctamente OVER_BUDGET");
  }

  const wrongEnv = {
    ...overBudget,
    environment: "production",
  };
  const wrongEnvFile = path.join(tmp, "production.json");
  fs.writeFileSync(wrongEnvFile, JSON.stringify(wrongEnv), "utf8");

  const rejected = run(["--evidence", wrongEnvFile]);
  if (rejected.status !== 1) {
    throw new Error("H1 debe rechazar evidencia fuera de staging");
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

const requiredFiles = [
  "docs/H1_ZERO_COST_STAGING.md",
  "ROADMAP.md",
  ".github/workflows/quality.yml",
  "package.json",
];
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    throw new Error(`Falta archivo contractual H1: ${file}`);
  }
}

console.log("✓ Contratos H1 de staging gratuito verificados.");
