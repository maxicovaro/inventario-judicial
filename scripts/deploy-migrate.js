const sequelize = require("../src/config/database");
const { runMigrations } = require("../src/db/migrator");
const { verifyBackupFile } = require("./db-cli-utils");
const { validateDeployment } = require("./deploy-preflight");

const argValue = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};

const main = async () => {
  const preflight = validateDeployment(process.env);
  if (!preflight.ok) {
    throw new Error(`Preflight rechazado: ${preflight.errors.join("; ")}`);
  }

  const backupPath = argValue("--backup");
  if (!backupPath) {
    throw new Error(
      "Uso: npm run deploy:migrate -- --backup backups/pre-deploy.sql",
    );
  }

  const verified = verifyBackupFile(backupPath);
  const currentDatabase = String(process.env.DB_NAME || "").trim();
  const backupDatabase = String(verified.metadata?.database || "").trim();

  if (!backupDatabase || backupDatabase !== currentDatabase) {
    throw new Error(
      `El backup verificado pertenece a ${backupDatabase || "una base desconocida"}, no a ${currentDatabase}`,
    );
  }

  console.log(`✓ Backup pre-migración verificado para ${currentDatabase}.`);
  console.log(`✓ SHA-256: ${verified.sha256}`);

  const executed = await runMigrations();
  if (executed.length === 0) {
    console.log("✓ No había migraciones pendientes.");
    return;
  }

  for (const migration of executed) {
    console.log(`✓ Migración aplicada: ${migration}`);
  }
};

main()
  .catch((error) => {
    console.error(`✗ Migración de despliegue rechazada: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await sequelize.close();
    } catch {}
  });
