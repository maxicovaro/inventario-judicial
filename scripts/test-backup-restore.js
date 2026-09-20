const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const mysql = require("mysql2/promise");
const sequelize = require("../src/config/database");
const {
  parseMysqlDumpStatements,
  prepareMysql2Statements,
} = require("./db-restore");

const TICK = String.fromCharCode(96);

const runNode = (args, extraEnv = {}) => {
  const result = spawnSync(process.execPath, args, {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, ...extraEnv },
    encoding: "utf8",
    windowsHide: true,
  });

  if (result.status !== 0) {
    throw new Error(
      [result.stdout, result.stderr].filter(Boolean).join("\n").trim() ||
        "Comando falló con código " + result.status,
    );
  }

  return result;
};

const verifyToken = async ({
  host,
  port,
  user,
  password,
  database,
  token,
}) => {
  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
  });
  try {
    const [rows] = await connection.query(
      "SELECT token FROM p3_backup_probe WHERE id = 1",
    );
    if (rows.length !== 1 || rows[0].token !== token) {
      throw new Error(
        "La restauración " +
          database +
          " no preservó el dato de control esperado",
      );
    }
  } finally {
    await connection.end();
  }
};

const assertMysqlDumpParser = () => {
  const dumpProbe = [
    "-- MySQL dump",
    "/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;",
    "DROP TABLE IF EXISTS `probe`;",
    "/*!40101 SET @saved_cs_client = @@character_set_client */;",
    "CREATE TABLE `probe` (",
    "  `id` int NOT NULL,",
    "  `texto` varchar(100) DEFAULT NULL,",
    "  PRIMARY KEY (`id`)",
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
    "LOCK TABLES `probe` WRITE;",
    "/*!40000 ALTER TABLE `probe` DISABLE KEYS */;",
    "INSERT INTO `probe` VALUES (1,'valor;con;punto y coma');",
    "/*!40000 ALTER TABLE `probe` ENABLE KEYS */;",
    "UNLOCK TABLES;",
  ].join("\n");

  const parsed = parseMysqlDumpStatements(dumpProbe);
  if (parsed.some((statement) => statement.trim() === "")) {
    throw new Error("El parser no debe producir sentencias vacías");
  }

  const executable = prepareMysql2Statements(dumpProbe);
  assert.deepStrictEqual(
    executable.map((statement) => statement.kind),
    ["DROP_TABLE", "CREATE_TABLE", "INSERT"],
  );
  assert.deepStrictEqual(
    executable.map((statement) => statement.table),
    ["probe", "probe", "probe"],
  );
  assert.match(executable[2].sql, /valor;con;punto y coma/);

  assert.throws(
    () =>
      prepareMysql2Statements(
        "CREATE TRIGGER t BEFORE INSERT ON probe FOR EACH ROW SET @a=1;",
      ),
    /sentencia no permitida/,
  );
};

const main = async () => {
  assertMysqlDumpParser();

  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "inventario-backup-test-"),
  );
  const backupPath = path.join(tempDir, "backup.sql");
  const targetCli = "inventario_restore_cli_ci_" + process.pid;
  const targetFallback = "inventario_restore_mysql2_ci_" + process.pid;
  const token = "probe-" + Date.now();

  const restoreHost = process.env.RESTORE_DB_HOST || process.env.DB_HOST;
  const restorePort = Number(
    process.env.RESTORE_DB_PORT || process.env.DB_PORT || 3306,
  );
  const restoreUser = process.env.RESTORE_DB_USER || process.env.DB_USER;
  const restorePassword =
    process.env.RESTORE_DB_PASSWORD || process.env.DB_PASSWORD;

  try {
    await sequelize.authenticate();
    await sequelize.query(
      "CREATE TABLE IF NOT EXISTS p3_backup_probe (" +
        "id INT PRIMARY KEY, " +
        "token VARCHAR(120) NOT NULL" +
        ") ENGINE=InnoDB",
    );
    await sequelize.query("DELETE FROM p3_backup_probe");
    await sequelize.query(
      "INSERT INTO p3_backup_probe (id, token) VALUES (1, ?)",
      { replacements: [token] },
    );

    runNode(["scripts/db-backup.js", "--output", backupPath]);
    runNode(["scripts/db-backup-verify.js", backupPath]);

    runNode(
      [
        "scripts/db-restore.js",
        backupPath,
        "--target",
        targetCli,
        "--confirm",
        targetCli,
        "--recreate",
      ],
      { RESTORE_DB_NAME: targetCli },
    );

    await verifyToken({
      host: restoreHost,
      port: restorePort,
      user: restoreUser,
      password: restorePassword,
      database: targetCli,
      token,
    });

    const fallback = runNode(
      [
        "scripts/db-restore.js",
        backupPath,
        "--target",
        targetFallback,
        "--confirm",
        targetFallback,
        "--recreate",
      ],
      {
        RESTORE_DB_NAME: targetFallback,
        MYSQL_BIN: "__mysql_missing_for_h1_test__",
        DB_RESTORE_DRIVER: "auto",
      },
    );

    if (!fallback.stdout.includes("Driver de restore: mysql2")) {
      throw new Error(
        "El restore no activó el fallback mysql2 cuando mysql CLI no existe",
      );
    }
    if (!fallback.stdout.includes("Sentencias restauradas por mysql2:")) {
      throw new Error(
        "El fallback mysql2 no informó cuántas sentencias restauró",
      );
    }

    await verifyToken({
      host: restoreHost,
      port: restorePort,
      user: restoreUser,
      password: restorePassword,
      database: targetFallback,
      token,
    });

    console.log(
      "✓ Backup/checksum restaurados con mysql CLI y fallback mysql2 sobre bases descartables.",
    );
  } finally {
    try {
      const admin = await mysql.createConnection({
        host: restoreHost,
        port: restorePort,
        user: restoreUser,
        password: restorePassword,
      });
      for (const target of [targetCli, targetFallback]) {
        await admin.query(
          "DROP DATABASE IF EXISTS " + TICK + target + TICK,
        );
      }
      await admin.end();
    } catch {}

    try {
      await sequelize.query("DROP TABLE IF EXISTS p3_backup_probe");
    } catch {}

    await sequelize.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

main().catch((error) => {
  console.error("✗ Prueba de backup/restore falló: " + error.message);
  process.exitCode = 1;
});
