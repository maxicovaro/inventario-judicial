const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  decryptBuffer,
  encryptBuffer,
} = require("./pilot-backup-s3");

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
const backupS3 = read("scripts/pilot-backup-s3.js");
const s3Client = read("src/utils/s3ObjectClient.js");
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
    "source_snapshot",
    "captureDatabaseShape",
    "La base cambió durante la ventana del backup",
    "PILOT_BACKUP_REQUIRE_SECONDARY",
    "uploadEncryptedBackup",
    "secondary_copy_verified",
    "pilot_backup_completed",
  ],
  "scripts/pilot-backup-run.js",
);

assertIncludes(
  backupS3,
  [
    "AES-256-GCM",
    "PILOT_BACKUP_S3_ENDPOINT",
    "PILOT_BACKUP_S3_BUCKET",
    "PILOT_BACKUP_S3_ACCESS_KEY_ID",
    "PILOT_BACKUP_S3_SECRET_ACCESS_KEY",
    "PILOT_BACKUP_ENCRYPTION_KEY",
    "uploadEncryptedBackup",
    "downloadLatestEncryptedBackup",
    "plaintext_sha256",
    "source_snapshot",
    "pruneEncryptedBackups",
  ],
  "scripts/pilot-backup-s3.js",
);

assertIncludes(
  s3Client,
  [
    "AWS4-HMAC-SHA256",
    "X-Amz-Content-Sha256",
    "putObject",
    "getObject",
    "deleteObject",
  ],
  "src/utils/s3ObjectClient.js",
);

assertIncludes(
  restore,
  [
    '["staging", "test"].includes(environment)',
    "scripts/db-restore.js",
    "restore drill nunca puede usar la base activa",
    "information_schema.TABLES",
    "COUNT(*)",
    "source_snapshot",
    "snapshot del backup",
    "DROP DATABASE IF EXISTS",
    "downloadLatestEncryptedBackup",
    "encrypted-bucket",
    "source_cleanup_ok",
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
    "PILOT_BACKUP_S3_KEEP=7",
    "PILOT_BACKUP_ENCRYPTION_KEY",
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
    'PILOT_BACKUP_REQUIRE_SECONDARY: "true"',
    "npm run pilot:backup:run",
    "npm run pilot:restore:drill",
    "Restore drill P9.5 CI finalizó",
  ],
  ".github/workflows/quality.yml",
);

const cryptoKey = crypto.randomBytes(32);
const cryptoProbe = Buffer.from(
  "P9.5 debe poder cifrar y recuperar el backup sin pérdida",
  "utf8",
);
const encryptedProbe = encryptBuffer(cryptoProbe, cryptoKey);
const recoveredProbe = decryptBuffer(encryptedProbe, cryptoKey);

if (!recoveredProbe.equals(cryptoProbe)) {
  throw new Error("La copia cifrada P9.5 no recupera exactamente el contenido");
}
if (encryptedProbe.includes(cryptoProbe)) {
  throw new Error("La copia cifrada P9.5 expone el contenido en claro");
}
let wrongKeyRejected = false;
try {
  decryptBuffer(encryptedProbe, crypto.randomBytes(32));
} catch {
  wrongKeyRejected = true;
}
if (!wrongKeyRejected) {
  throw new Error("AES-GCM P9.5 debe rechazar una clave incorrecta");
}

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
