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

const parseMysqlDumpStatements = (source) => {
  const sql = String(source || "");
  const statements = [];
  let buffer = "";
  let quote = null;
  let index = 0;

  const pushStatement = () => {
    const statement = buffer.trim();
    buffer = "";
    if (statement) statements.push(statement);
  };

  while (index < sql.length) {
    const char = sql[index];
    const next = sql[index + 1] || "";

    if (quote) {
      buffer += char;

      if ((quote === "'" || quote === '"') && char === "\" && index + 1 < sql.length) {
        buffer += sql[index + 1];
        index += 2;
        continue;
      }

      if (char === quote) {
        if (sql[index + 1] === quote) {
          buffer += sql[index + 1];
          index += 2;
          continue;
        }
        quote = null;
      }

      index += 1;
      continue;
    }

    if (char === "'" || char === '"' || char === TICK) {
      quote = char;
      buffer += char;
      index += 1;
      continue;
    }

    if (char === "-" && next === "-" && /\s/.test(sql[index + 2] || "")) {
      const end = sql.indexOf("\n", index + 2);
      if (end === -1) break;
      buffer += "\n";
      index = end + 1;
      continue;
    }

    if (char === "#") {
      const end = sql.indexOf("\n", index + 1);
      if (end === -1) break;
      buffer += "\n";
      index = end + 1;
      continue;
    }

    if (char === "/" && next === "*") {
      const end = sql.indexOf("*/", index + 2);
      if (end === -1) {
        throw new Error("El dump contiene un comentario SQL sin cierre");
      }
      index = end + 2;
      continue;
    }

    if (char === ";") {
      pushStatement();
      index += 1;
      continue;
    }

    buffer += char;
    index += 1;
  }

  if (quote) {
    throw new Error("El dump contiene una cadena o identificador sin cierre");
  }

  pushStatement();
  return statements;
};

const statementKind = (statement) => {
  const normalized = String(statement || "").trim();
  const patterns = [
    ["DROP_TABLE", /^DROP\s+TABLE\b/i],
    ["CREATE_TABLE", /^CREATE\s+TABLE\b/i],
    ["INSERT", /^INSERT\s+INTO\b/i],
    ["LOCK_TABLES", /^LOCK\s+TABLES\b/i],
    ["UNLOCK_TABLES", /^UNLOCK\s+TABLES\b/i],
  ];

  for (const [kind, pattern] of patterns) {
    if (pattern.test(normalized)) return kind;
  }

  if (/^SET\b/i.test(normalized)) return "SET";
  return "UNSUPPORTED";
};

const statementTable = (statement, kind) => {
  const normalized = String(statement || "").trim();
  const match =
    kind === "DROP_TABLE"
      ? normalized.match(/^DROP\s+TABLE(?:\s+IF\s+EXISTS)?\s+`?([^`\s,;]+)`?/i)
      : kind === "CREATE_TABLE"
        ? normalized.match(/^CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+`?([^`\s(;]+)`?/i)
        : kind === "INSERT"
          ? normalized.match(/^INSERT\s+INTO\s+`?([^`\s(;]+)`?/i)
          : null;
  return match?.[1] || null;
};

const prepareMysql2Statements = (source) => {
  const parsed = parseMysqlDumpStatements(source);
  const executable = [];

  for (const statement of parsed) {
    const kind = statementKind(statement);

    if (["LOCK_TABLES", "UNLOCK_TABLES", "SET"].includes(kind)) {
      continue;
    }

    if (kind === "UNSUPPORTED") {
      const preview = statement.replace(/\s+/g, " ").slice(0, 80);
      throw new Error(
        `El fallback mysql2 encontró una sentencia no permitida: ${preview}`,
      );
    }

    executable.push({
      sql: statement,
      kind,
      table: statementTable(statement, kind),
    });
  }

  if (executable.length === 0) {
    throw new Error("El dump no contiene sentencias restaurables");
  }

  return executable;
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
  const statements = prepareMysql2Statements(rawDump);

  const connection = await mysql.createConnection(
    mysql2ConnectionOptions(restoreConfig, {
      database: target,
      multipleStatements: false,
    }),
  );

  let foreignKeyChecksDisabled = false;
  try {
    await connection.query("SET FOREIGN_KEY_CHECKS=0");
    foreignKeyChecksDisabled = true;

    for (let index = 0; index < statements.length; index += 1) {
      const statement = statements[index];
      try {
        await connection.query(statement.sql);
      } catch (error) {
        const label = statement.table
          ? `${statement.kind} ${statement.table}`
          : statement.kind;
        throw new Error(
          `mysql2 falló en sentencia ${index + 1}/${statements.length} (${label}): ${error.message}`,
        );
      }
    }
  } finally {
    if (foreignKeyChecksDisabled) {
      try {
        await connection.query("SET FOREIGN_KEY_CHECKS=1");
      } catch {}
    }
    await connection.end();
  }

  return statements.length;
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

  let restoredStatements = null;
  if (useCli) {
    restoreWithCli({
      backup,
      restoreConfig,
      target,
      recreate,
      mysqlCommand,
    });
  } else {
    restoredStatements = await restoreWithMysql2({
      backup,
      restoreConfig,
      target,
      recreate,
    });
  }

  console.log("✓ Backup restaurado en la base destino: " + target);
  console.log("✓ Driver de restore: " + (useCli ? "mysql-cli" : "mysql2"));
  if (restoredStatements !== null) {
    console.log("✓ Sentencias restauradas por mysql2: " + restoredStatements);
  }
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
  parseMysqlDumpStatements,
  prepareMysql2Statements,
  restoreDriver,
  statementKind,
  statementTable,
};
