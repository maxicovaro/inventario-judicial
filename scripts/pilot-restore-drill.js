const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const mysql = require("mysql2/promise");
const {
  databaseConfig,
  mysql2SslOptions,
  validateDatabaseName,
  verifyBackupFile,
} = require("./db-cli-utils");
const {
  downloadLatestEncryptedBackup,
  s3Configured,
} = require("./pilot-backup-s3");

require("dotenv").config();

const argValue = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};

const runtimeEnvironment = () =>
  String(process.env.DEPLOY_ENV || process.env.NODE_ENV || "").trim().toLowerCase();

const ensureAllowedEnvironment = () => {
  const environment = runtimeEnvironment();
  if (!["staging", "test"].includes(environment)) {
    throw new Error(
      `pilot:restore:drill sólo puede ejecutarse en staging/test; entorno actual: ${environment || "no definido"}`,
    );
  }
  return environment;
};

const parsePositiveNumber = (value, fallback, label) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} debe ser mayor que cero`);
  }
  return parsed;
};

const safeTargetName = () => {
  const requested = argValue("--target") || process.env.PILOT_RESTORE_TARGET;
  if (requested) return validateDatabaseName(requested);

  const suffix = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  return validateDatabaseName(`inventario_restore_drill_${suffix}`);
};

const resolveBackup = async () => {
  const explicitBackup = argValue("--backup");
  if (explicitBackup) {
    return {
      backupPath: path.resolve(explicitBackup),
      manifest: null,
      manifestPath: null,
      source: "explicit",
      cleanupDirectory: null,
    };
  }

  const manifestArg =
    argValue("--manifest") ||
    process.env.PILOT_BACKUP_MANIFEST ||
    (runtimeEnvironment() === "staging"
      ? "/tmp/pilot-backups/daily/latest.json"
      : "pilot-backup-results/latest.json");

  const manifestPath = path.resolve(manifestArg);
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (!manifest.backup_path) {
      throw new Error("El manifiesto no contiene backup_path");
    }

    return {
      backupPath: path.resolve(path.dirname(manifestPath), manifest.backup_path),
      manifest,
      manifestPath,
      source: "manifest",
      cleanupDirectory: null,
    };
  }

  if (!s3Configured()) {
    throw new Error(
      `No existe el manifiesto local (${manifestPath}) y no hay bucket P9.5 configurado`,
    );
  }

  const cleanupDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "inventario-restore-source-"),
  );
  try {
    const recovered = await downloadLatestEncryptedBackup({
      outputDirectory: cleanupDirectory,
    });
    return {
      backupPath: recovered.backupPath,
      manifest: null,
      manifestPath: null,
      source: "encrypted-bucket",
      cleanupDirectory,
    };
  } catch (error) {
    fs.rmSync(cleanupDirectory, { recursive: true, force: true });
    throw error;
  }
};

const runRestore = (backupPath, target) => {
  const result = spawnSync(
    process.execPath,
    [
      "scripts/db-restore.js",
      backupPath,
      "--target",
      target,
      "--confirm",
      target,
      "--recreate",
    ],
    {
      cwd: path.resolve(__dirname, ".."),
      env: {
        ...process.env,
        RESTORE_DB_NAME: target,
      },
      encoding: "utf8",
      windowsHide: true,
    },
  );

  if (result.status !== 0) {
    throw new Error(
      [result.stdout, result.stderr].filter(Boolean).join("\n").trim() ||
        `Restore falló con código ${result.status}`,
    );
  }
};

const restoreDatabaseConfig = (source, target) =>
  databaseConfig("RESTORE_DB", {
    host: source.host,
    port: source.port,
    name: target,
    user: source.user,
    password: source.password,
    ssl: source.ssl,
    sslRejectUnauthorized: source.sslRejectUnauthorized,
    sslCaPath: source.sslCaPath,
  });

const connectionConfig = (config, includeDatabase = true) => ({
  host: config.host,
  port: config.port,
  user: config.user,
  password: config.password,
  ...(includeDatabase ? { database: config.name } : {}),
  ...(config.ssl ? { ssl: mysql2SslOptions(config) } : {}),
});

const quoteIdentifier = (value) => `\`${String(value).replace(/\`/g, "\`\`")}\``;

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

const sameObject = (left, right) =>
  JSON.stringify(left) === JSON.stringify(right);

const writeReport = (reportPath, report) => {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
};

const main = async () => {
  const environment = ensureAllowedEnvironment();
  const source = databaseConfig();
  const resolved = await resolveBackup();
  const verified = verifyBackupFile(resolved.backupPath);
  const sourceSnapshot =
    verified.metadata.source_snapshot || resolved.manifest?.source_snapshot || null;
  const target = safeTargetName();
  const restoreConfig = restoreDatabaseConfig(source, target);

  if (
    !sourceSnapshot ||
    !Array.isArray(sourceSnapshot.tables) ||
    !sourceSnapshot.counts ||
    typeof sourceSnapshot.counts !== "object"
  ) {
    throw new Error(
      "El backup no contiene source_snapshot verificable para comparar tablas y conteos",
    );
  }

  if (target.toLowerCase() === source.name.toLowerCase()) {
    throw new Error("El restore drill nunca puede usar la base activa como destino");
  }

  const rpoTargetHours = parsePositiveNumber(
    process.env.PILOT_RPO_TARGET_HOURS,
    24,
    "PILOT_RPO_TARGET_HOURS",
  );
  const rtoTargetMinutes = parsePositiveNumber(
    process.env.PILOT_RTO_TARGET_MINUTES,
    240,
    "PILOT_RTO_TARGET_MINUTES",
  );

  const reportPath = path.resolve(
    argValue("--report") ||
      process.env.PILOT_RESTORE_REPORT ||
      "pilot-backup-results/restore-drill.json",
  );

  const startedAt = new Date();
  const backupCreatedAt = new Date(verified.metadata.created_at);
  if (Number.isNaN(backupCreatedAt.getTime())) {
    throw new Error("El backup no tiene created_at válido");
  }

  const rpoHours =
    (startedAt.getTime() - backupCreatedAt.getTime()) / (60 * 60 * 1000);

  let targetConnection;
  let adminConnection;
  let failure = null;
  let failureStage = null;
  let tableCount = 0;
  let rowCount = 0;
  let exactTableCountsMatch = false;
  let validationFinishedAt = null;
  let cleanupOk = false;
  let sourceCleanupOk = resolved.cleanupDirectory ? false : true;

  try {
    failureStage = "restore";
    runRestore(resolved.backupPath, target);

    failureStage = "validation";
    targetConnection = await mysql.createConnection(
      connectionConfig(restoreConfig),
    );

    const targetTables = await listTables(targetConnection, target);

    if (JSON.stringify(sourceSnapshot.tables) !== JSON.stringify(targetTables)) {
      throw new Error(
        "El esquema restaurado no coincide con el snapshot registrado al crear el backup",
      );
    }

    const targetCounts = await tableCounts(targetConnection, targetTables);

    if (!sameObject(sourceSnapshot.counts, targetCounts)) {
      throw new Error(
        "Los conteos de filas del restore no coinciden con el snapshot del backup",
      );
    }

    exactTableCountsMatch = true;
    tableCount = targetTables.length;
    rowCount = Object.values(targetCounts).reduce(
      (total, value) => total + Number(value),
      0,
    );
    validationFinishedAt = new Date();
  } catch (error) {
    failure = error;
  } finally {
    try {
      if (targetConnection) await targetConnection.end();
    } catch {}
    try {
      failureStage = failure ? failureStage : "cleanup";
      adminConnection = await mysql.createConnection(
        connectionConfig(restoreConfig, false),
      );
      await adminConnection.query(
        `DROP DATABASE IF EXISTS ${quoteIdentifier(target)}`,
      );
      cleanupOk = true;
    } catch (error) {
      if (!failure) {
        failure = error;
        failureStage = "cleanup";
      }
    } finally {
      try {
        if (adminConnection) await adminConnection.end();
      } catch {}
    }

    if (resolved.cleanupDirectory) {
      try {
        fs.rmSync(resolved.cleanupDirectory, {
          recursive: true,
          force: true,
        });
        sourceCleanupOk = true;
      } catch (error) {
        if (!failure) {
          failure = error;
          failureStage = "source_cleanup";
        }
      }
    }
  }

  const finishedAt = new Date();
  const effectiveValidationFinish = validationFinishedAt || finishedAt;
  const rtoMinutes =
    (effectiveValidationFinish.getTime() - startedAt.getTime()) / (60 * 1000);

  const rpoMet = rpoHours <= rpoTargetHours;
  const rtoMet = rtoMinutes <= rtoTargetMinutes;
  const success =
    !failure && cleanupOk && sourceCleanupOk && rpoMet && rtoMet;

  const report = {
    schema_version: 1,
    environment,
    revision: String(process.env.DEPLOY_REVISION || "").trim() || null,
    status: success ? "PASS" : "FAIL",
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    backup_created_at: backupCreatedAt.toISOString(),
    backup_file: path.basename(verified.backupPath),
    backup_sha256: verified.sha256,
    backup_source: resolved.source,
    restored_database: target,
    source_database: source.name,
    validation: {
      table_count: tableCount,
      row_count: rowCount,
      exact_table_counts_match: exactTableCountsMatch,
      target_cleanup_ok: cleanupOk,
      source_cleanup_ok: sourceCleanupOk,
    },
    objectives: {
      rpo_target_hours: rpoTargetHours,
      rpo_actual_hours: Number(rpoHours.toFixed(4)),
      rpo_met: rpoMet,
      rto_target_minutes: rtoTargetMinutes,
      rto_actual_minutes: Number(rtoMinutes.toFixed(4)),
      rto_met: rtoMet,
    },
    failure_stage: success ? null : failureStage,
  };

  writeReport(reportPath, report);

  console.log(
    JSON.stringify({
      event: "pilot_restore_drill_completed",
      environment,
      status: report.status,
      rpo_actual_hours: report.objectives.rpo_actual_hours,
      rto_actual_minutes: report.objectives.rto_actual_minutes,
      table_count: report.validation.table_count,
      row_count: report.validation.row_count,
      backup_source: report.backup_source,
      target_cleanup_ok: report.validation.target_cleanup_ok,
      source_cleanup_ok: report.validation.source_cleanup_ok,
    }),
  );

  if (!success) {
    if (failure) {
      throw new Error(
        `Restore drill P9.5 falló en ${failureStage}: ${failure.message}`,
      );
    }
    throw new Error("Restore drill P9.5 incumplió RPO/RTO objetivo");
  }
};

main().catch((error) => {
  console.error(`✗ Restore drill P9.5 falló: ${error.message}`);
  process.exitCode = 1;
});
