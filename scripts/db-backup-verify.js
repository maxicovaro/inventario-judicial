const { verifyBackupFile } = require("./db-cli-utils");

const backupPath = process.argv[2];

if (!backupPath) {
  console.error("Uso: node scripts/db-backup-verify.js <backup.sql>");
  process.exit(1);
}

try {
  const result = verifyBackupFile(backupPath);
  console.log(`✓ Backup verificado: ${result.backupPath}`);
  console.log(`✓ SHA-256: ${result.sha256}`);
  console.log(`✓ Bytes: ${result.bytes}`);
} catch (error) {
  console.error(`✗ Verificación falló: ${error.message}`);
  process.exitCode = 1;
}
