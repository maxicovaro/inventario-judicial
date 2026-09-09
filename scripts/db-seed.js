const sequelize = require("../src/config/database");
require("../src/models");
const seedInitialData = require("../src/seeders/initialData");

const main = async () => {
  try {
    await sequelize.authenticate();
    await seedInitialData();
  } finally {
    await sequelize.close();
  }
};

main().catch((error) => {
  console.error("✗ Error cargando datos base:", error);
  process.exitCode = 1;
});
