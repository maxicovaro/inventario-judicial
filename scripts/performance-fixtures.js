const sequelize = require("../src/config/database");
const { Activo, Insumo, Oficina } = require("../src/models");
const { resetIntegrationData } = require("./integration-fixtures");

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const TARGET_ACTIVOS = parsePositiveInt(process.env.PERF_ACTIVOS, 6000);
const TARGET_INSUMOS = parsePositiveInt(process.env.PERF_INSUMOS, 300);
const CHUNK_SIZE = 500;

const preparePerformanceDataset = async () => {
  const fixtures = await resetIntegrationData();
  const oficinas = await Oficina.findAll({
    attributes: ["id", "nombre"],
    order: [["id", "ASC"]],
  });

  if (oficinas.length === 0) {
    throw new Error("No hay oficinas disponibles para construir el dataset P8");
  }

  const activosActuales = await Activo.count();
  let pendientes = Math.max(0, TARGET_ACTIVOS - activosActuales);
  let correlativo = 1;

  while (pendientes > 0) {
    const cantidad = Math.min(CHUNK_SIZE, pendientes);
    const filas = Array.from({ length: cantidad }, (_, index) => {
      const numero = correlativo + index;
      const oficina = oficinas[(numero - 1) % oficinas.length];
      return {
        codigo_interno: `PERF-${String(numero).padStart(6, "0")}`,
        nombre: `Activo sintético P8 ${numero}`,
        descripcion: "Dataset sintético reproducible para baseline de rendimiento P8.0",
        marca: `Marca ${numero % 25}`,
        modelo: `Modelo ${numero % 80}`,
        numero_serie: `SERIE-P8-${String(numero).padStart(8, "0")}`,
        cantidad: 1,
        estado: numero % 17 === 0 ? "Regular estado" : "Buen estado",
        categoria_id: fixtures.categoria.id,
        oficina_id: oficina.id,
        activo: true,
        observaciones: numero % 10 === 0 ? "Registro sintético con observación" : null,
      };
    });

    await Activo.bulkCreate(filas, { validate: true });
    correlativo += cantidad;
    pendientes -= cantidad;
  }

  const insumosActuales = await Insumo.count();
  const insumosPendientes = Math.max(0, TARGET_INSUMOS - insumosActuales);
  if (insumosPendientes > 0) {
    await Insumo.bulkCreate(
      Array.from({ length: insumosPendientes }, (_, index) => ({
        nombre: `Insumo sintético P8 ${index + 1}`,
        descripcion: "Dataset sintético reproducible para baseline de rendimiento P8.0",
        categoria: ["Librería", "Limpieza", "Informática"][index % 3],
        unidad_medida: ["unidad", "caja", "paquete", "resma"][index % 4],
        stock_actual: 20 + (index % 180),
        stock_minimo: 10,
        activo: true,
      })),
      { validate: true },
    );
  }

  const resultado = {
    activos: await Activo.count(),
    insumos: await Insumo.count(),
    oficinas: oficinas.length,
    admin_email: fixtures.users.admin.email,
    responsable_email: fixtures.users.responsable1.email,
  };

  console.log(`PERF_DATASET ${JSON.stringify(resultado)}`);
  return resultado;
};

const main = async () => {
  try {
    await preparePerformanceDataset();
  } finally {
    await sequelize.close();
  }
};

if (require.main === module) {
  main().catch((error) => {
    console.error(`✗ Dataset P8.0 falló: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { preparePerformanceDataset, TARGET_ACTIVOS, TARGET_INSUMOS };
