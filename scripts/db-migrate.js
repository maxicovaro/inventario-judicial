const sequelize = require("../src/config/database");
const { runMigrations } = require("../src/db/migrator");

const main = async () => {
  try {
    const executed = await runMigrations();

    if (executed.length === 0) {
      console.log("✓ Base de datos al día. No hay migraciones pendientes.");
      return;
    }

    for (const migration of executed) {
      console.log(`✓ Migración aplicada: ${migration}`);
    }
  } finally {
    await sequelize.close();
  }
};

main().catch((error) => {
  console.error("✗ Error ejecutando migraciones:", error);
  process.exitCode = 1;
});
