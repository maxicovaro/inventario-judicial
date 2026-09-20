const fs = require("fs");
const path = require("path");

const PRICING = Object.freeze({
  ram_per_gb_month: 10,
  cpu_per_vcpu_month: 20,
  volume_per_gb_month: 0.15,
  bucket_per_gb_month: 0.015,
});

const argValue = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};

const requiredNumber = (value, label, { min = 0 } = {}) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min) {
    throw new Error(`${label} debe ser numérico y >= ${min}`);
  }
  return parsed;
};

const readEvidence = () => {
  const input = argValue("--evidence");
  if (!input) throw new Error("Falta --evidence <archivo.json>");
  const file = path.resolve(input);
  if (!fs.existsSync(file)) throw new Error(`No existe la evidencia: ${file}`);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (data.schema_version !== 1) {
    throw new Error("schema_version H1 debe ser 1");
  }
  if (data.environment !== "staging") {
    throw new Error("H1 sólo evalúa evidencia de staging");
  }
  return { file, data };
};

const serviceCost = (service) => {
  const memory = requiredNumber(
    service.average_memory_gb,
    `services.${service.name}.average_memory_gb`,
  );
  const cpu = requiredNumber(
    service.average_cpu_vcpu,
    `services.${service.name}.average_cpu_vcpu`,
  );
  const activeHours = requiredNumber(
    service.projected_active_hours_per_day,
    `services.${service.name}.projected_active_hours_per_day`,
  );
  if (activeHours > 24) {
    throw new Error(
      `services.${service.name}.projected_active_hours_per_day no puede superar 24`,
    );
  }

  const continuousMemory = memory * PRICING.ram_per_gb_month;
  const continuousCpu = cpu * PRICING.cpu_per_vcpu_month;
  const continuous = continuousMemory + continuousCpu;
  const dutyCycle = activeHours / 24;

  return {
    name: service.name,
    average_memory_gb: memory,
    average_cpu_vcpu: cpu,
    projected_active_hours_per_day: activeHours,
    duty_cycle: dutyCycle,
    continuous_monthly_usd: continuous,
    projected_monthly_usd: continuous * dutyCycle,
  };
};

const round = (value, digits = 4) => Number(value.toFixed(digits));

const main = () => {
  const { file, data } = readEvidence();

  const freeCredit = requiredNumber(
    data.free_credit_usd,
    "free_credit_usd",
    { min: 0.01 },
  );
  const services = (data.services || []).map(serviceCost);
  if (!services.length) throw new Error("H1 requiere al menos un servicio");

  const volumeGb = requiredNumber(
    data.storage?.volume_used_gb || 0,
    "storage.volume_used_gb",
  );
  const bucketGb = requiredNumber(
    data.storage?.bucket_used_gb || 0,
    "storage.bucket_used_gb",
  );

  const continuousCompute = services.reduce(
    (sum, item) => sum + item.continuous_monthly_usd,
    0,
  );
  const projectedCompute = services.reduce(
    (sum, item) => sum + item.projected_monthly_usd,
    0,
  );
  const persistentStorage =
    volumeGb * PRICING.volume_per_gb_month +
    bucketGb * PRICING.bucket_per_gb_month;

  const continuousTotal = continuousCompute + persistentStorage;
  const projectedTotal = projectedCompute + persistentStorage;
  const availableForCompute = Math.max(0, freeCredit - persistentStorage);
  const maxUniformDuty =
    continuousCompute > 0
      ? Math.min(1, availableForCompute / continuousCompute)
      : 1;
  const maxUniformActiveHoursPerDay = maxUniformDuty * 24;

  const report = {
    schema_version: 1,
    evaluated_at: new Date().toISOString(),
    evidence_file: path.basename(file),
    environment: data.environment,
    pricing: PRICING,
    free_credit_usd: freeCredit,
    services: services.map((item) => ({
      ...item,
      duty_cycle: round(item.duty_cycle, 6),
      continuous_monthly_usd: round(item.continuous_monthly_usd),
      projected_monthly_usd: round(item.projected_monthly_usd),
    })),
    storage: {
      volume_used_gb: volumeGb,
      bucket_used_gb: bucketGb,
      monthly_usd: round(persistentStorage),
    },
    totals: {
      continuous_monthly_usd: round(continuousTotal),
      projected_monthly_usd: round(projectedTotal),
      free_credit_usd: round(freeCredit),
      projected_headroom_usd: round(freeCredit - projectedTotal),
      max_uniform_active_hours_per_day: round(
        maxUniformActiveHoursPerDay,
        2,
      ),
    },
    status: projectedTotal <= freeCredit ? "PASS" : "OVER_BUDGET",
    guardrail:
      "PASS significa costo proyectado dentro del crédito Free; no garantiza disponibilidad ni reemplaza la verificación real de sleep/wake.",
  };

  const output = argValue("--output");
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (output) {
    const resolved = path.resolve(output);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, json, "utf8");
    console.log(`✓ Presupuesto H1 generado: ${resolved}`);
  } else {
    process.stdout.write(json);
  }

  if (report.status !== "PASS") process.exitCode = 2;
};

try {
  main();
} catch (error) {
  console.error(`✗ Presupuesto H1 falló: ${error.message}`);
  process.exitCode = 1;
}
