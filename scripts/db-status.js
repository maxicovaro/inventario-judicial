const sequelize = require("../src/config/database");
const { getMigrationStatus } = require("../src/db/migrator");

const main = async () => {
  try {
    const status = await getMigrationStatus();

    for (const migration of status) {
      console.log(`${migration.applied ? "[x]" : "[ ]"} ${migration.name}`);
    }

    const pending = status.filter((migration) => !migration.applied);

    if (pending.length > 0) {
      console.log(`\n${pending.length} migración(es) pendiente(s).`);
      process.exitCode = 2;
      return;
    }

    console.log("\n✓ Base de datos al día.");
  } finally {
    await sequelize.close();
  }
};

main().catch((error) => {
  console.error("✗ Error consultando estado de migraciones:", error);
  process.exitCode = 1;
});
