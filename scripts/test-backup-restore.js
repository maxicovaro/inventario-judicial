const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const mysql = require("mysql2/promise");
const sequelize = require("../src/config/database");

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
        `Comando falló con código ${result.status}`,
    );
  }

  return result;
};

const main = async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "inventario-backup-test-"));
  const backupPath = path.join(tempDir, "backup.sql");
  const targetDb = `inventario_restore_ci_${process.pid}`;
  const token = `probe-${Date.now()}`;
  let restoreConnection;

  const restoreHost = process.env.RESTORE_DB_HOST || process.env.DB_HOST;
  const restorePort = Number(process.env.RESTORE_DB_PORT || process.env.DB_PORT || 3306);
  const restoreUser = process.env.RESTORE_DB_USER || process.env.DB_USER;
  const restorePassword = process.env.RESTORE_DB_PASSWORD || process.env.DB_PASSWORD;

  try {
    await sequelize.authenticate();
    await sequelize.query(
      `CREATE TABLE IF NOT EXISTS p3_backup_probe (
        id INT PRIMARY KEY,
        token VARCHAR(120) NOT NULL
      ) ENGINE=InnoDB`,
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
        targetDb,
        "--confirm",
        targetDb,
        "--recreate",
      ],
      { RESTORE_DB_NAME: targetDb },
    );

    restoreConnection = await mysql.createConnection({
      host: restoreHost,
      port: restorePort,
      user: restoreUser,
      password: restorePassword,
      database: targetDb,
    });

    const [rows] = await restoreConnection.query(
      "SELECT token FROM p3_backup_probe WHERE id = 1",
    );

    if (rows.length !== 1 || rows[0].token !== token) {
      throw new Error("La restauración no preservó el dato de control esperado");
    }

    console.log("✓ Backup, checksum y restauración verificados sobre una base descartable.");
  } finally {
    if (restoreConnection) await restoreConnection.end();

    try {
      const admin = await mysql.createConnection({
        host: restoreHost,
        port: restorePort,
        user: restoreUser,
        password: restorePassword,
      });
      await admin.query(`DROP DATABASE IF EXISTS \`${targetDb}\``);
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
  console.error(`✗ Prueba de backup/restore falló: ${error.message}`);
  process.exitCode = 1;
});
