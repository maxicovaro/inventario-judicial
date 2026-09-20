const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const mysql = require("mysql2/promise");
const {
  databaseConfig,
  metadataPathFor,
  verifyBackupFile,
} = require("./db-cli-utils");
const {
  s3Configured,
  uploadEncryptedBackup,
} = require("./pilot-backup-s3");

require("dotenv").config();

const argValue = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};

const timestamp = () =>
  new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

const runtimeEnvironment = () =>
  String(process.env.DEPLOY_ENV || process.env.NODE_ENV || "").trim().toLowerCase();

const ensureAllowedEnvironment = () => {
  const environment = runtimeEnvironment();
  if (!["staging", "test"].includes(environment)) {
    throw new Error(
      `pilot:backup:run sólo puede ejecutarse en staging/test; entorno actual: ${environment || "no definido"}`,
    );
  }
  return environment;
};

const boolEnv = (name) =>
  ["1", "true", "yes"].includes(
    String(process.env[name] || "").trim().toLowerCase(),
  );

const parsePositiveInt = (value, fallback, label) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 365) {
    throw new Error(`${label} debe ser un entero entre 1 y 365`);
  }
  return parsed;
};

const runNode = (args) => {
  const result = spawnSync(process.execPath, args, {
    cwd: path.resolve(__dirname, ".."),
    env: process.env,
    encoding: "utf8",
    windowsHide: true,
  });

  if (result.status !== 0) {
    throw new Error(
      [result.stdout, result.stderr].filter(Boolean).join("\n").trim() ||
        `Comando falló con código ${result.status}`,
    );
  }
};

const listBackups = (directory) =>
  fs
    .readdirSync(directory, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        /^inventario-(?:staging|test)-\d{8}T\d{6}Z\.sql$/.test(entry.name),
    )
    .map((entry) => {
      const backupPath = path.join(directory, entry.name);
      return {
        backupPath,
        metadataPath: metadataPathFor(backupPath),
        mtimeMs: fs.statSync(backupPath).mtimeMs,
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

const pruneBackups = (directory, keep) => {
  const backups = listBackups(directory);
  const deleted = [];

  for (const item of backups.slice(keep)) {
    fs.rmSync(item.backupPath, { force: true });
    fs.rmSync(item.metadataPath, { force: true });
    deleted.push(path.basename(item.backupPath));
  }

  return deleted;
};

const quoteIdentifier = (value) =>
  `\`${String(value).replace(/\`/g, "\`\`")}\``;

const listTables = async (connection, database) => {
  const [rows] = await connection.query(
    `SELECT TABLE_NAME
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
        AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME`,
    [database],
  );
  return rows.map((row) => row.TABLE_NAME);
};

const tableCounts = async (connection, tables) => {
  const counts = {};
  for (const table of tables) {
    const [rows] = await connection.query(
      `SELECT COUNT(*) AS total FROM ${quoteIdentifier(table)}`,
    );
    counts[table] = Number(rows[0].total);
  }
  return counts;
};

const captureDatabaseShape = async () => {
  const config = databaseConfig();
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.name,
  });

  try {
    const tables = await listTables(connection, config.name);
    const counts = await tableCounts(connection, tables);
    return {
      tables,
      counts,
      total_rows: Object.values(counts).reduce(
        (total, value) => total + Number(value),
        0,
      ),
    };
  } finally {
    await connection.end();
  }
};

const sameShape = (left, right) =>
  JSON.stringify(left.tables) === JSON.stringify(right.tables) &&
  JSON.stringify(left.counts) === JSON.stringify(right.counts);

const copyVerifiedPair = (verified, externalDirectory) => {
  fs.mkdirSync(externalDirectory, { recursive: true });

  const destination = path.join(
    externalDirectory,
    path.basename(verified.backupPath),
  );

  fs.copyFileSync(verified.backupPath, destination);
  fs.copyFileSync(verified.metadataPath, metadataPathFor(destination));

  const copied = verifyBackupFile(destination);
  if (copied.sha256 !== verified.sha256 || copied.bytes !== verified.bytes) {
    throw new Error("La copia externa no coincide con el backup de origen");
  }

  return copied;
};

const main = async () => {
  const environment = ensureAllowedEnvironment();
  const startedAt = new Date();
  const defaultOutput =
    environment === "staging"
      ? "/tmp/pilot-backups/daily"
      : "pilot-backup-results/daily";

  const outputDirectory = path.resolve(
    argValue("--output-dir") || process.env.PILOT_BACKUP_DIR || defaultOutput,
  );
  const keep = parsePositiveInt(
    argValue("--keep") || process.env.PILOT_BACKUP_KEEP,
    7,
    "PILOT_BACKUP_KEEP",
  );
  const externalArg =
    argValue("--external-dir") || process.env.PILOT_BACKUP_EXTERNAL_DIR || "";
  const externalDirectory = externalArg ? path.resolve(externalArg) : null;

  if (
    externalDirectory &&
    externalDirectory === outputDirectory
  ) {
    throw new Error(
      "PILOT_BACKUP_EXTERNAL_DIR debe ser distinto del directorio primario",
    );
  }

  fs.mkdirSync(outputDirectory, { recursive: true });

  const backupPath = path.join(
    outputDirectory,
    `inventario-${environment}-${timestamp()}.sql`,
  );

  const sourceShapeBefore = await captureDatabaseShape();
  runNode(["scripts/db-backup.js", "--output", backupPath]);
  const sourceShapeAfter = await captureDatabaseShape();

  if (!sameShape(sourceShapeBefore, sourceShapeAfter)) {
    fs.rmSync(backupPath, { force: true });
    fs.rmSync(metadataPathFor(backupPath), { force: true });
    throw new Error(
      "La base cambió durante la ventana del backup; se descarta el dump y debe reintentarse",
    );
  }

  const initialVerification = verifyBackupFile(backupPath);
  const enrichedMetadata = {
    ...initialVerification.metadata,
    source_snapshot: {
      captured_at: new Date().toISOString(),
      tables: sourceShapeAfter.tables,
      counts: sourceShapeAfter.counts,
      total_rows: sourceShapeAfter.total_rows,
    },
  };
  fs.writeFileSync(
    initialVerification.metadataPath,
    `${JSON.stringify(enrichedMetadata, null, 2)}\n`,
    "utf8",
  );

  const verified = verifyBackupFile(backupPath);
  const deleted = pruneBackups(outputDirectory, keep);

  let externalCopy = {
    enabled: false,
    verified: false,
  };

  if (externalDirectory) {
    const copied = copyVerifiedPair(verified, externalDirectory);
    externalCopy = {
      enabled: true,
      verified: true,
      backup_file: path.basename(copied.backupPath),
      bytes: copied.bytes,
      sha256: copied.sha256,
    };
  }

  let bucketCopy = {
    enabled: false,
    verified: false,
    encrypted: false,
  };

  if (s3Configured()) {
    bucketCopy = await uploadEncryptedBackup(verified);
  }

  const secondaryVerified =
    Boolean(externalCopy.verified) || Boolean(bucketCopy.verified);

  if (boolEnv("PILOT_BACKUP_REQUIRE_SECONDARY") && !secondaryVerified) {
    throw new Error(
      "PILOT_BACKUP_REQUIRE_SECONDARY exige una segunda copia verificada",
    );
  }

  const manifestPath = path.resolve(
    argValue("--manifest") ||
      process.env.PILOT_BACKUP_MANIFEST ||
      path.join(outputDirectory, "latest.json"),
  );
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });

  const finishedAt = new Date();
  const manifest = {
    schema_version: 1,
    environment,
    revision: String(process.env.DEPLOY_REVISION || "").trim() || null,
    database: verified.metadata.database,
    created_at: verified.metadata.created_at,
    completed_at: finishedAt.toISOString(),
    duration_ms: finishedAt.getTime() - startedAt.getTime(),
    backup_path: path.relative(path.dirname(manifestPath), verified.backupPath),
    bytes: verified.bytes,
    sha256: verified.sha256,
    source_snapshot: verified.metadata.source_snapshot,
    retention: {
      keep,
      deleted,
    },
    external_copy: externalCopy,
    bucket_copy: bucketCopy,
    secondary_copy_verified: secondaryVerified,
  };

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify({
      event: "pilot_backup_completed",
      environment,
      revision: manifest.revision,
      bytes: verified.bytes,
      sha256: verified.sha256,
      retained: Math.min(listBackups(outputDirectory).length, keep),
      external_copy_verified: externalCopy.verified,
      bucket_copy_verified: bucketCopy.verified,
      secondary_copy_verified: secondaryVerified,
      duration_ms: manifest.duration_ms,
    }),
  );
};

main().catch((error) => {
  console.error(`✗ Backup periódico P9.5 falló: ${error.message}`);
  process.exitCode = 1;
});
