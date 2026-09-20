const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const {
  databaseConfig,
  mysqlEnvironment,
  mysqlCliTlsArgs,
  mysql2SslOptions,
  run,
  validateDatabaseName,
  verifyBackupFile,
} = require("./db-cli-utils");

const SYSTEM_DATABASES = new Set([
  "information_schema",
  "mysql",
  "performance_schema",
  "sys",
]);

const RESTORE_DRIVERS = new Set(["auto", "cli", "mysql2"]);
const TICK = String.fromCharCode(96);

const argValue = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};

const hasArg = (name) => process.argv.includes(name);

const quoteIdentifier = (value) =>
  TICK + String(value).replace(new RegExp(TICK, "g"), TICK + TICK) + TICK;

const commandMissing = (error) =>
  /(?:\bENOENT\b|not found|no such file)/i.test(String(error?.message || error));

const restoreDriver = () => {
  const driver = String(process.env.DB_RESTORE_DRIVER || "auto")
    .trim()
    .toLowerCase();
  if (!RESTORE_DRIVERS.has(driver)) {
    throw new Error("DB_RESTORE_DRIVER debe ser auto, cli o mysql2");
  }
  return driver;
};

const sanitizeDumpForMysql2 = (source) => {
  const sql = String(source || "");

  if (/^\s*DELIMITER\b/im.test(sql)) {
    throw new Error(
      "El fallback mysql2 no admite dumps con DELIMITER; usar el cliente mysql nativo",
    );
  }

  if (
    /\bCREATE\s+(?:DEFINER\s*=\s*[^\s]+\s+)?(?:PROCEDURE|FUNCTION|TRIGGER|EVENT)\b/i.test(
      sql,
    )
  ) {
    throw new Error(
      "El fallback mysql2 no admite rutinas/triggers/eventos; usar el cliente mysql nativo",
    );
  }

  if (
    /^\s*(?:CREATE|DROP)\s+DATABASE\b/im.test(sql) ||
    /^\s*USE\s+/im.test(sql)
  ) {
    throw new Error(
      "El dump intenta seleccionar/crear/eliminar bases; restore mysql2 sólo admite la base destino validada",
    );
  }

  return sql
    .replace(/\/\*!\d{5}\s+[\s\S]*?\*\//g, "")
    .replace(/^\s*LOCK TABLES\b.*?;\s*$/gim, "")
    .replace(/^\s*UNLOCK TABLES\s*;\s*$/gim, "")
    .trim();
};

const mysql2ConnectionOptions = (config, extra = {}) => ({
  host: config.host,
  port: config.port,
  user: config.user,
  password: config.password,
  charset: "utf8mb4",
  ...(config.ssl ? { ssl: mysql2SslOptions(config) } : {}),
  ...extra,
});

const prepareTargetWithMysql2 = async (config, target, recreate) => {
  const admin = await mysql.createConnection(
    mysql2ConnectionOptions(config, { multipleStatements: false }),
  );
  try {
    if (recreate) {
      await admin.query("DROP DATABASE IF EXISTS " + quoteIdentifier(target));
    }
    await admin.query(
      "CREATE DATABASE IF NOT EXISTS " +
        quoteIdentifier(target) +
        " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
    );
  } finally {
    await admin.end();
  }
};

const restoreWithMysql2 = async ({ backup, restoreConfig, target, recreate }) => {
  await prepareTargetWithMysql2(restoreConfig, target, recreate);

  const rawDump = fs.readFileSync(path.resolve(backup.backupPath), "utf8");
  const dump = sanitizeDumpForMysql2(rawDump);
  if (!dump) {
    throw new Error("El dump quedó vacío después de aplicar las guardas mysql2");
  }

  const connection = await mysql.createConnection(
    mysql2ConnectionOptions(restoreConfig, {
      database: target,
      multipleStatements: true,
    }),
  );

  let foreignKeyChecksDisabled = false;
  try {
    await connection.query("SET FOREIGN_KEY_CHECKS=0");
    foreignKeyChecksDisabled = true;
    await connection.query(dump);
  } finally {
    if (foreignKeyChecksDisabled) {
      try {
        await connection.query("SET FOREIGN_KEY_CHECKS=1");
      } catch {}
    }
    await connection.end();
  }
};

const restoreWithCli = ({
  backup,
  restoreConfig,
  target,
  recreate,
  mysqlCommand,
}) => {
  const connectionArgs = [
    "--host=" + restoreConfig.host,
    "--port=" + restoreConfig.port,
    "--user=" + restoreConfig.user,
    ...mysqlCliTlsArgs(restoreConfig),
    "--default-character-set=utf8mb4",
  ];

  const quotedTarget = quoteIdentifier(target);
  const prepareSql = recreate
    ? "DROP DATABASE IF EXISTS " +
      quotedTarget +
      "; CREATE DATABASE " +
      quotedTarget +
      " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    : "CREATE DATABASE IF NOT EXISTS " +
      quotedTarget +
      " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;";

  run(mysqlCommand, [...connectionArgs, "--execute", prepareSql], {
    env: mysqlEnvironment(restoreConfig.password),
  });

  const fd = fs.openSync(path.resolve(backup.backupPath), "r");
  try {
    run(mysqlCommand, [...connectionArgs, target], {
      env: mysqlEnvironment(restoreConfig.password),
      stdio: [fd, "pipe", "pipe"],
      encoding: null,
    });
  } finally {
    fs.closeSync(fd);
  }
};

const main = async () => {
  const backupArg = process.argv[2];
  if (!backupArg || backupArg.startsWith("--")) {
    throw new Error(
      "Uso: node scripts/db-restore.js <backup.sql> --target <base> --confirm <base> [--recreate]",
    );
  }

  const backup = verifyBackupFile(backupArg);
  const source = databaseConfig();
  const restoreConfig = databaseConfig("RESTORE_DB", {
    host: source.host,
    port: source.port,
    name: argValue("--target") || process.env.RESTORE_DB_NAME,
    user: source.user,
    password: source.password,
    ssl: source.ssl,
    sslRejectUnauthorized: source.sslRejectUnauthorized,
    sslCaPath: source.sslCaPath,
  });

  const target = validateDatabaseName(argValue("--target") || restoreConfig.name);
  const normalizedTarget = target.toLowerCase();
  const normalizedSource = source.name.toLowerCase();
  const confirmation = argValue("--confirm");
  const recreate = hasArg("--recreate");

  if (SYSTEM_DATABASES.has(normalizedTarget)) {
    throw new Error("Se bloqueó la restauración sobre un esquema de sistema de MySQL");
  }

  if (confirmation !== target) {
    throw new Error("La restauración requiere --confirm con el nombre exacto de la base destino");
  }

  if (
    normalizedTarget === normalizedSource &&
    process.env.ALLOW_RESTORE_CURRENT_DB !== "true"
  ) {
    throw new Error(
      "Se bloqueó la restauración sobre la base activa. Usá otra base destino o ALLOW_RESTORE_CURRENT_DB=true de forma explícita",
    );
  }

  const driver = restoreDriver();
  const mysqlCommand = process.env.MYSQL_BIN || "mysql";
  let useCli = driver === "cli";

  if (driver === "auto") {
    try {
      run(mysqlCommand, ["--version"]);
      useCli = true;
    } catch (error) {
      if (!commandMissing(error)) throw error;
      useCli = false;
      console.log(
        "ℹ Cliente mysql no disponible; usando fallback mysql2 protegido para restore.",
      );
    }
  } else if (driver === "cli") {
    run(mysqlCommand, ["--version"]);
  }

  if (useCli) {
    restoreWithCli({
      backup,
      restoreConfig,
      target,
      recreate,
      mysqlCommand,
    });
  } else {
    await restoreWithMysql2({
      backup,
      restoreConfig,
      target,
      recreate,
    });
  }

  console.log("✓ Backup restaurado en la base destino: " + target);
  console.log("✓ Driver de restore: " + (useCli ? "mysql-cli" : "mysql2"));
  console.log("✓ Backup verificado previamente con SHA-256: " + backup.sha256);
};

if (require.main === module) {
  main().catch((error) => {
    console.error("✗ Restauración falló: " + error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  commandMissing,
  restoreDriver,
  sanitizeDumpForMysql2,
};
