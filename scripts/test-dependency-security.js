const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");
const sharp = require("sharp");
const ExcelJS = require("exceljs");
const { Sequelize, DataTypes } = require("sequelize");

const packageJson = require("../package.json");
const frontendPackage = require("../inventario-frontend/package.json");

const probar = async () => {
  assert.strictEqual(packageJson.dependencies.multer, "^2.3.0");
  assert.strictEqual(packageJson.dependencies.mysql2, "^3.23.1");
  assert.strictEqual(packageJson.dependencies.sharp, "^0.35.4");
  assert.strictEqual(packageJson.overrides.exceljs.uuid, "11.1.1");
  assert.strictEqual(packageJson.overrides.sequelize.uuid, "11.1.1");

  assert.strictEqual(frontendPackage.dependencies.axios, "^1.18.0");
  assert.strictEqual(frontendPackage.dependencies["react-router-dom"], "^7.18.2");
  assert.strictEqual(frontendPackage.devDependencies.vite, "^8.2.2");

  const excelRequire = createRequire(require.resolve("exceljs"));
  const sequelizeRequire = createRequire(require.resolve("sequelize"));
  const excelUuid = excelRequire("uuid");
  const sequelizeUuid = sequelizeRequire("uuid");

  assert.strictEqual(typeof excelUuid.v4, "function");
  assert.strictEqual(typeof sequelizeUuid.v4, "function");

  const image = await sharp({
    create: {
      width: 2,
      height: 2,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .png()
    .toBuffer();

  assert.ok(Buffer.isBuffer(image));
  assert.ok(image.length > 0);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Smoke");
  sheet.getCell("A1").value = "Inventario Judicial";
  const workbookBuffer = await workbook.xlsx.writeBuffer();

  assert.ok(workbookBuffer.length > 0);

  const sequelize = new Sequelize("inventario_smoke", "user", "password", {
    dialect: "mysql",
    logging: false,
  });

  try {
    const Smoke = sequelize.define("SmokeDependency", {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
    });

    const instance = Smoke.build({});
    assert.ok(instance.get("id"));
  } finally {
    await sequelize.close();
  }

  const backendLock = fs.readFileSync(path.resolve("package-lock.json"), "utf8");
  const frontendLock = fs.readFileSync(
    path.resolve("inventario-frontend/package-lock.json"),
    "utf8",
  );

  assert.match(backendLock, /"sharp": "\^0\.35\.4"/);
  assert.match(frontendLock, /"vite": "\^8\.2\.2"/);

  console.log("Seguridad y compatibilidad de dependencias validadas correctamente.");
};

probar().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
