const fs = require("fs");
const path = require("path");
const sequelize = require("../config/database");

const MIGRATION_TABLE = "schema_migrations";
const MIGRATIONS_DIR = path.join(__dirname, "migrations");

const ensureMigrationTable = async () => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS \`${MIGRATION_TABLE}\` (
      name VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
};

const getMigrationFiles = () =>
  fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".js"))
    .sort();

const getAppliedMigrations = async () => {
  const [rows] = await sequelize.query(
    `SELECT name FROM \`${MIGRATION_TABLE}\` ORDER BY name ASC`,
  );

  return new Set(rows.map((row) => row.name));
};

const loadMigration = (file) => {
  const migrationPath = path.join(MIGRATIONS_DIR, file);
  const migration = require(migrationPath);

  if (!migration || typeof migration.up !== "function") {
    throw new Error(`La migración ${file} no exporta una función up()`);
  }

  return migration;
};

const getMigrationStatus = async () => {
  await sequelize.authenticate();
  await ensureMigrationTable();

  const files = getMigrationFiles();
  const applied = await getAppliedMigrations();

  return files.map((name) => ({
    name,
    applied: applied.has(name),
  }));
};

const runMigrations = async () => {
  await sequelize.authenticate();
  await ensureMigrationTable();

  const files = getMigrationFiles();
  const applied = await getAppliedMigrations();
  const executed = [];

  for (const file of files) {
    if (applied.has(file)) continue;

    const migration = loadMigration(file);

    await migration.up({
      sequelize,
      queryInterface: sequelize.getQueryInterface(),
    });

    await sequelize.query(
      `INSERT INTO \`${MIGRATION_TABLE}\` (name) VALUES (?)`,
      {
        replacements: [file],
      },
    );

    executed.push(file);
  }

  return executed;
};

module.exports = {
  MIGRATION_TABLE,
  MIGRATIONS_DIR,
  getMigrationFiles,
  getMigrationStatus,
  runMigrations,
};
