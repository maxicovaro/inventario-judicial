const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const assertIncludes = (source, fragments, label) => {
  for (const fragment of fragments) {
    if (!source.includes(fragment)) {
      throw new Error(`Contrato P9.5 incumplido en ${label}: falta ${fragment}`);
    }
  }
};

const backup = read("scripts/pilot-backup-run.js");
const restore = read("scripts/pilot-restore-drill.js");
const documentation = read("docs/P9_5_PILOT_BACKUP_RECOVERY.md");
const operations = read("docs/OPERATIONS.md");
const docsIndex = read("docs/README.md");
const roadmap = read("ROADMAP.md");
const workflow = read(".github/workflows/quality.yml");
const envExample = read(".env.example");
const gitignore = read(".gitignore");
const packageJson = JSON.parse(read("package.json"));

assertIncludes(
  backup,
  [
    '["staging", "test"].includes(environment)',
    "scripts/db-backup.js",
    "verifyBackupFile",
    "PILOT_BACKUP_KEEP",
    "PILOT_BACKUP_EXTERNAL_DIR",
    "pilot_backup_completed",
  ],
  "scripts/pilot-backup-run.js",
);

assertIncludes(
  restore,
  [
    '["staging", "test"].includes(environment)',
    "scripts/db-restore.js",
    "restore drill nunca puede usar la base activa",
    "information_schema.TABLES",
    "COUNT(*)",
    "DROP DATABASE IF EXISTS",
    "PILOT_RPO_TARGET_HOURS",
    "PILOT_RTO_TARGET_MINUTES",
    "pilot_restore_drill_completed",
  ],
  "scripts/pilot-restore-drill.js",
);

assertIncludes(
  documentation,
  [
    "# P9.5 — Backup y recuperación periódica del piloto",
    "RPO",
    "RTO",
    "checksum",
    "restore drill",
    "Railway",
    "P9.6",
  ],
  "docs/P9_5_PILOT_BACKUP_RECOVERY.md",
);

assertIncludes(
  operations,
  ["P9.5", "backup periódico", "restore drill"],
  "docs/OPERATIONS.md",
);

assertIncludes(
  docsIndex,
  ["P9_5_PILOT_BACKUP_RECOVERY.md", "P9.5"],
  "docs/README.md",
);

assertIncludes(
  roadmap,
  [
    "P9.5 — Backup y recuperación durante el piloto",
    "P9.5 permanece bloqueado",
    "P9.6",
  ],
  "ROADMAP.md",
);

assertIncludes(
  envExample,
  [
    "PILOT_BACKUP_KEEP=7",
    "PILOT_RPO_TARGET_HOURS=24",
    "PILOT_RTO_TARGET_MINUTES=240",
  ],
  ".env.example",
);

if (!gitignore.includes("pilot-backup-results/")) {
  throw new Error("Los resultados reales P9.5 deben permanecer fuera de Git");
}

assertIncludes(
  workflow,
  [
    "Run P9.5 backup and restore drill",
    "npm run pilot:backup:run",
    "npm run pilot:restore:drill",
    "Restore drill P9.5 CI finalizó",
  ],
  ".github/workflows/quality.yml",
);

if (
  packageJson.scripts?.["pilot:backup:run"] !==
  "node scripts/pilot-backup-run.js"
) {
  throw new Error("package.json debe exponer pilot:backup:run");
}

if (
  packageJson.scripts?.["pilot:restore:drill"] !==
  "node scripts/pilot-restore-drill.js"
) {
  throw new Error("package.json debe exponer pilot:restore:drill");
}

if (
  packageJson.scripts?.["test:p9-backup-recovery-contracts"] !==
  "node scripts/test-p9-backup-recovery-contracts.js"
) {
  throw new Error("package.json debe exponer test:p9-backup-recovery-contracts");
}

if (
  !String(packageJson.scripts?.test || "").includes(
    "test:p9-backup-recovery-contracts",
  )
) {
  throw new Error("npm test debe ejecutar test:p9-backup-recovery-contracts");
}

console.log("✓ Contratos P9.5 de backup y recuperación periódica verificados.");
