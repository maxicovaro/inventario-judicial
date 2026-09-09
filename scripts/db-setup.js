const sequelize = require("../src/config/database");
require("../src/models");
const { runMigrations } = require("../src/db/migrator");
const seedInitialData = require("../src/seeders/initialData");

const main = async () => {
  try {
    const executed = await runMigrations();

    for (const migration of executed) {
      console.log(`✓ Migración aplicada: ${migration}`);
    }

    await seedInitialData();
    console.log("✓ Base preparada correctamente.");
  } finally {
    await sequelize.close();
  }
};

main().catch((error) => {
  console.error("✗ Error preparando la base de datos:", error);
  process.exitCode = 1;
});
