const fs = require("fs");
const path = require("path");
const {
  databaseConfig,
  mysqlEnvironment,
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

const argValue = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};

const hasArg = (name) => process.argv.includes(name);

const main = () => {
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

  const mysqlCommand = process.env.MYSQL_BIN || "mysql";
  run(mysqlCommand, ["--version"]);

  const connectionArgs = [
    `--host=${restoreConfig.host}`,
    `--port=${restoreConfig.port}`,
    `--user=${restoreConfig.user}`,
    "--default-character-set=utf8mb4",
  ];

  const quotedTarget = `\`${target}\``;
  const prepareSql = recreate
    ? `DROP DATABASE IF EXISTS ${quotedTarget}; CREATE DATABASE ${quotedTarget} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    : `CREATE DATABASE IF NOT EXISTS ${quotedTarget} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`;

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

  console.log(`✓ Backup restaurado en la base destino: ${target}`);
  console.log(`✓ Backup verificado previamente con SHA-256: ${backup.sha256}`);
};

try {
  main();
} catch (error) {
  console.error(`✗ Restauración falló: ${error.message}`);
  process.exitCode = 1;
}
