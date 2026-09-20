const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const assertIncludes = (source, fragments, label) => {
  for (const fragment of fragments) {
    if (!source.includes(fragment)) {
      throw new Error(`Contrato P9.6 incumplido en ${label}: falta ${fragment}`);
    }
  }
};

const runGate = (evidence, output) =>
  spawnSync(
    process.execPath,
    [
      path.join(root, "scripts/pilot-exit-gate.js"),
      "--evidence",
      evidence,
      "--output",
      output,
    ],
    {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
    },
  );

const evaluator = read("scripts/pilot-exit-gate.js");
const example = JSON.parse(read("pilot/exit-gate.example.json"));
const packageJson = JSON.parse(read("package.json"));
const roadmap = read("ROADMAP.md");
const qualityWorkflow = read(".github/workflows/quality.yml");
const docsIndex = read("docs/README.md");
const gitignore = read(".gitignore");

assertIncludes(
  evaluator,
  [
    "ELIGIBLE_FOR_INSTITUTIONAL_APPROVAL",
    "APPROVED_FOR_PRODUCTION_PLANNING",
    "P9.6 sólo evalúa evidencia de staging/test",
    "max_runtime_p95_ms: 500",
    "max_rpo_hours: 24",
    "max_rto_minutes: 240",
    "min_first_wave_scenarios: 12",
    "min_verified_pilot_users: 4",
    "min_pilot_offices_with_activity: 2",
    "min_controlled_load_concurrency: 20",
    "Una aprobación institucional requiere approved_by_role y decision_reference",
    "Este gate no despliega producción",
  ],
  "scripts/pilot-exit-gate.js",
);

if (
  packageJson.scripts?.["pilot:exit:gate"] !==
  "node scripts/pilot-exit-gate.js"
) {
  throw new Error("package.json debe exponer pilot:exit:gate");
}

if (
  packageJson.scripts?.["test:p9-exit-gate-contracts"] !==
  "node scripts/test-p9-exit-gate-contracts.js"
) {
  throw new Error("package.json debe exponer test:p9-exit-gate-contracts");
}

if (
  !String(packageJson.scripts?.test || "").includes(
    "test:p9-exit-gate-contracts",
  )
) {
  throw new Error("npm test debe ejecutar test:p9-exit-gate-contracts");
}

assertIncludes(
  roadmap,
  ["P9.6 — Criterios de salida", "P9.6"],
  "ROADMAP.md",
);
assertIncludes(
  docsIndex,
  ["P9_6_EXIT_CRITERIA.md", "P9.6"],
  "docs/README.md",
);
assertIncludes(
  qualityWorkflow,
  ["Run P9.6 pilot exit gate", "pilot:exit:gate"],
  ".github/workflows/quality.yml",
);

if (!gitignore.includes("pilot-exit-results/")) {
  throw new Error("Los resultados reales P9.6 deben permanecer fuera de Git");
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "inventario-p9-6-"));

try {
  const passEvidence = path.join(temp, "pass.json");
  const passOutput = path.join(temp, "pass-output.json");
  fs.writeFileSync(passEvidence, JSON.stringify(example, null, 2));

  const pass = runGate(passEvidence, passOutput);
  if (pass.status !== 0) {
    throw new Error(
      `La evidencia válida P9.6 debía pasar: ${pass.stdout}\n${pass.stderr}`,
    );
  }

  const passReport = JSON.parse(fs.readFileSync(passOutput, "utf8"));
  if (
    passReport.technical_status !== "PASS" ||
    passReport.institutional_status !== "PENDING" ||
    passReport.decision !== "ELIGIBLE_FOR_INSTITUTIONAL_APPROVAL" ||
    passReport.failures.length !== 0
  ) {
    throw new Error("El resultado positivo P9.6 no cumple el contrato");
  }

  const failEvidence = path.join(temp, "fail.json");
  const failOutput = path.join(temp, "fail-output.json");
  fs.writeFileSync(
    failEvidence,
    JSON.stringify(
      {
        ...example,
        stability: {
          ...example.stability,
          http_5xx: 1,
        },
      },
      null,
      2,
    ),
  );

  const fail = runGate(failEvidence, failOutput);
  if (fail.status !== 2) {
    throw new Error(
      `Un 5xx debe bloquear P9.6 con exit code 2; recibido: ${fail.status}`,
    );
  }
  const failReport = JSON.parse(fs.readFileSync(failOutput, "utf8"));
  if (
    failReport.technical_status !== "FAIL" ||
    failReport.decision !== "BLOCKED" ||
    !failReport.failures.some((item) => item.id === "no_5xx")
  ) {
    throw new Error("El resultado negativo P9.6 no bloqueó correctamente");
  }

  const approvalEvidence = path.join(temp, "approval-without-proof.json");
  fs.writeFileSync(
    approvalEvidence,
    JSON.stringify(
      {
        ...example,
        institutional: {
          approval_status: "APPROVED",
        },
      },
      null,
      2,
    ),
  );
  const approval = runGate(
    approvalEvidence,
    path.join(temp, "approval-output.json"),
  );
  if (approval.status !== 1) {
    throw new Error(
      "Una aprobación sin rol/referencia debe ser rechazada por el gate",
    );
  }
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log("✓ Contratos P9.6 del gate de salida verificados.");
