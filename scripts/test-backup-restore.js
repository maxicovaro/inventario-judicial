const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const mysql = require("mysql2/promise");
const sequelize = require("../src/config/database");
const { sanitizeDumpForMysql2 } = require("./db-restore");

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

const main = async () => {
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

  assert.throws(
    () =>
      sanitizeDumpForMysql2(
        "DELIMITER $$\nCREATE TRIGGER x BEFORE INSERT ON t FOR EACH ROW SET @a=1$$",
      ),
    /no admite dumps con DELIMITER/,
  );
  assert.throws(
    () => sanitizeDumpForMysql2("CREATE DATABASE unsafe;"),
    /sólo admite la base destino validada/,
  );

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
