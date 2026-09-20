const fs = require("fs");
const path = require("path");

const THRESHOLDS = Object.freeze({
  min_http_requests: 100,
  max_http_5xx: 0,
  max_runtime_p95_ms: 500,
  max_open_sev1: 0,
  max_open_sev2: 0,
  min_first_wave_scenarios: 12,
  min_verified_pilot_users: 4,
  min_active_pilot_users: 4,
  min_pilot_offices_with_activity: 2,
  max_backup_age_hours: 24,
  max_rpo_hours: 24,
  max_rto_minutes: 240,
  min_controlled_load_concurrency: 20,
  max_controlled_load_error_rate_pct: 0,
});

const argValue = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};

const requiredNumber = (value, label) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} debe ser numérico`);
  return parsed;
};

const requiredBoolean = (value, label) => {
  if (typeof value !== "boolean") throw new Error(`${label} debe ser booleano`);
  return value;
};

const readEvidence = () => {
  const input = argValue("--evidence");
  if (!input) throw new Error("Falta --evidence <archivo.json>");
  const file = path.resolve(input);
  if (!fs.existsSync(file)) throw new Error(`No existe la evidencia: ${file}`);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (data.schema_version !== 1) throw new Error("schema_version P9.6 debe ser 1");
  if (!["staging", "test"].includes(data.environment)) {
    throw new Error("P9.6 sólo evalúa evidencia de staging/test");
  }
  return { file, data };
};

const assertNoSensitiveKeys = (value, trail = []) => {
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (/(password|passwd|secret|token|cookie|authorization|email|totp|recovery_code)/i.test(key)) {
      throw new Error(`La evidencia P9.6 contiene una clave sensible/no permitida: ${[...trail, key].join(".")}`);
    }
    assertNoSensitiveKeys(nested, [...trail, key]);
  }
};

const criterion = (dimension, id, description, pass, observed, expected) => ({
  dimension,
  id,
  description,
  status: pass ? "PASS" : "FAIL",
  observed,
  expected,
});

const eq = (actual, expected) => actual === expected;
const lte = (actual, expected) => actual <= expected;
const gte = (actual, expected) => actual >= expected;

const evaluate = (e) => {
  const c = [];

  const stability = e.stability || {};
  c.push(
    criterion("stability","health_ready","/health/ready operativo",
      requiredBoolean(stability.health_ready_200,"stability.health_ready_200"), true, "true"),
    criterion("stability","deployment_success","deployment terminal exitoso",
      requiredBoolean(stability.deployment_success,"stability.deployment_success"), true, "true"),
    criterion("stability","representative_http_sample","muestra HTTP mínima",
      gte(requiredNumber(stability.http_requests,"stability.http_requests"),THRESHOLDS.min_http_requests),
      stability.http_requests, `>= ${THRESHOLDS.min_http_requests}`),
    criterion("stability","no_5xx","sin 5xx en la muestra de salida",
      eq(requiredNumber(stability.http_5xx,"stability.http_5xx"),THRESHOLDS.max_http_5xx),
      stability.http_5xx, `= ${THRESHOLDS.max_http_5xx}`),
    criterion("stability","no_open_sev1","sin SEV-1 abiertos",
      eq(requiredNumber(stability.open_sev1,"stability.open_sev1"),THRESHOLDS.max_open_sev1),
      stability.open_sev1, "= 0"),
    criterion("stability","no_open_sev2","sin SEV-2 abiertos",
      eq(requiredNumber(stability.open_sev2,"stability.open_sev2"),THRESHOLDS.max_open_sev2),
      stability.open_sev2, "= 0"),
  );

  const security = e.security || {};
  const activeAdmins = requiredNumber(security.active_admins,"security.active_admins");
  const mfaAdmins = requiredNumber(security.admins_with_mfa,"security.admins_with_mfa");
  c.push(
    criterion("security","admin_mfa_coverage","MFA en todos los ADMIN activos",
      activeAdmins > 0 && eq(mfaAdmins,activeAdmins),
      `${mfaAdmins}/${activeAdmins}`, "100%"),
    criterion("security","admins_central_only","sin ADMIN activos fuera de Dirección",
      eq(requiredNumber(security.admins_outside_direction,"security.admins_outside_direction"),0),
      security.admins_outside_direction, "= 0"),
    criterion("security","no_open_authz_incidents","sin incidentes abiertos de auth/permisos",
      eq(requiredNumber(security.open_auth_permission_incidents,"security.open_auth_permission_incidents"),0),
      security.open_auth_permission_incidents, "= 0"),
    criterion("security","security_regressions_green","regresiones auth/MFA/autorización verdes",
      requiredBoolean(security.security_regression_gate_green,"security.security_regression_gate_green"),
      security.security_regression_gate_green, "true"),
  );

  const integrity = e.integrity || {};
  for (const [id,label] of [
    ["open_stop_conditions","stop conditions abiertas"],
    ["data_loss_events","eventos de pérdida/corrupción"],
    ["auth_bypass_events","eventos de bypass de autorización"],
    ["stock_negative_events","señales de stock negativo"],
    ["duplicate_physical_operations","operaciones físicas duplicadas"],
    ["incomplete_idempotent_operations","operaciones idempotentes incompletas"],
  ]) {
    const value=requiredNumber(integrity[id],`integrity.${id}`);
    c.push(criterion("integrity",id,`sin ${label}`,eq(value,0),value,"= 0"));
  }
  c.push(
    criterion("integrity","first_wave_scenarios","escenarios funcionales de primera ola",
      gte(requiredNumber(integrity.first_wave_scenarios_passed,"integrity.first_wave_scenarios_passed"),THRESHOLDS.min_first_wave_scenarios),
      integrity.first_wave_scenarios_passed,`>= ${THRESHOLDS.min_first_wave_scenarios}`),
    criterion("integrity","verified_pilot_users","usuarios de primera ola verificados",
      gte(requiredNumber(integrity.first_wave_users_verified,"integrity.first_wave_users_verified"),THRESHOLDS.min_verified_pilot_users),
      integrity.first_wave_users_verified,`>= ${THRESHOLDS.min_verified_pilot_users}`),
  );

  const adoption = e.adoption || {};
  c.push(
    criterion("adoption","active_pilot_users","usuarios piloto activos",
      gte(requiredNumber(adoption.pilot_users_active,"adoption.pilot_users_active"),THRESHOLDS.min_active_pilot_users),
      adoption.pilot_users_active,`>= ${THRESHOLDS.min_active_pilot_users}`),
    criterion("adoption","verified_pilot_users","usuarios piloto verificados",
      gte(requiredNumber(adoption.pilot_users_verified,"adoption.pilot_users_verified"),THRESHOLDS.min_verified_pilot_users),
      adoption.pilot_users_verified,`>= ${THRESHOLDS.min_verified_pilot_users}`),
    criterion("adoption","offices_with_activity","oficinas piloto con actividad funcional real",
      gte(requiredNumber(adoption.pilot_offices_with_functional_activity,"adoption.pilot_offices_with_functional_activity"),THRESHOLDS.min_pilot_offices_with_activity),
      adoption.pilot_offices_with_functional_activity,`>= ${THRESHOLDS.min_pilot_offices_with_activity}`),
    criterion("adoption","critical_flows_exercised","flujos críticos ejercitados",
      requiredBoolean(adoption.critical_flows_exercised,"adoption.critical_flows_exercised"),
      adoption.critical_flows_exercised,"true"),
  );

  const operations = e.operations || {};
  c.push(
    criterion("operations","backup_freshness","backup verificado dentro del RPO operativo",
      lte(requiredNumber(operations.backup_age_hours,"operations.backup_age_hours"),THRESHOLDS.max_backup_age_hours),
      operations.backup_age_hours,`<= ${THRESHOLDS.max_backup_age_hours} h`),
    criterion("operations","secondary_backup","segunda copia verificada",
      requiredBoolean(operations.secondary_backup_verified,"operations.secondary_backup_verified"),
      operations.secondary_backup_verified,"true"),
    criterion("operations","restore_drill","restore drill real aprobado",
      requiredBoolean(operations.restore_drill_pass,"operations.restore_drill_pass"),
      operations.restore_drill_pass,"true"),
    criterion("operations","rpo","RPO real",
      lte(requiredNumber(operations.rpo_hours,"operations.rpo_hours"),THRESHOLDS.max_rpo_hours),
      operations.rpo_hours,`<= ${THRESHOLDS.max_rpo_hours} h`),
    criterion("operations","rto","RTO real",
      lte(requiredNumber(operations.rto_minutes,"operations.rto_minutes"),THRESHOLDS.max_rto_minutes),
      operations.rto_minutes,`<= ${THRESHOLDS.max_rto_minutes} min`),
    criterion("operations","backup_cron","backup periódico activo",
      requiredBoolean(operations.backup_cron_enabled,"operations.backup_cron_enabled"),
      operations.backup_cron_enabled,"true"),
    criterion("operations","runbooks","runbooks/procedimiento operativo disponibles",
      requiredBoolean(operations.runbooks_ready,"operations.runbooks_ready"),
      operations.runbooks_ready,"true"),
  );

  const performance = e.performance || {};
  c.push(
    criterion("performance","runtime_p95","latencia real p95 dentro del umbral P9.6",
      lte(requiredNumber(performance.runtime_p95_ms,"performance.runtime_p95_ms"),THRESHOLDS.max_runtime_p95_ms),
      performance.runtime_p95_ms,`<= ${THRESHOLDS.max_runtime_p95_ms} ms`),
    criterion("performance","no_resource_pressure","sin presión relevante de recursos",
      !requiredBoolean(performance.runtime_resource_pressure,"performance.runtime_resource_pressure"),
      performance.runtime_resource_pressure,"false"),
    criterion("performance","controlled_load_concurrency","carga controlada hasta concurrencia mínima",
      gte(requiredNumber(performance.controlled_load_max_concurrency,"performance.controlled_load_max_concurrency"),THRESHOLDS.min_controlled_load_concurrency),
      performance.controlled_load_max_concurrency,`>= ${THRESHOLDS.min_controlled_load_concurrency}`),
    criterion("performance","controlled_load_errors","sin errores en carga controlada",
      eq(requiredNumber(performance.controlled_load_error_rate_pct,"performance.controlled_load_error_rate_pct"),THRESHOLDS.max_controlled_load_error_rate_pct),
      performance.controlled_load_error_rate_pct,"= 0%"),
    criterion("performance","p8_regression_gate","regresiones de rendimiento verdes",
      requiredBoolean(performance.p8_regression_gate_green,"performance.p8_regression_gate_green"),
      performance.p8_regression_gate_green,"true"),
  );

  return c;
};

const main = () => {
  const { file, data } = readEvidence();
  assertNoSensitiveKeys(data);

  const criteria = evaluate(data);
  const failed = criteria.filter((item) => item.status === "FAIL");
  const byDimension = Object.fromEntries(
    [...new Set(criteria.map((item) => item.dimension))].map((dimension) => {
      const items = criteria.filter((item) => item.dimension === dimension);
      return [dimension, {
        status: items.every((item) => item.status === "PASS") ? "PASS" : "FAIL",
        passed: items.filter((item) => item.status === "PASS").length,
        total: items.length,
      }];
    }),
  );

  const technicalStatus = failed.length === 0 ? "PASS" : "FAIL";
  const approval = String(data.institutional?.approval_status || "PENDING").toUpperCase();
  if (!["PENDING","APPROVED","REJECTED"].includes(approval)) {
    throw new Error("institutional.approval_status debe ser PENDING, APPROVED o REJECTED");
  }

  let decision = "BLOCKED";
  if (technicalStatus === "PASS" && approval === "PENDING") {
    decision = "ELIGIBLE_FOR_INSTITUTIONAL_APPROVAL";
  } else if (technicalStatus === "PASS" && approval === "APPROVED") {
    decision = "APPROVED_FOR_PRODUCTION_PLANNING";
  }

  const report = {
    schema_version: 1,
    evaluated_at: new Date().toISOString(),
    evidence_file: path.basename(file),
    evidence_generated_at: data.generated_at || null,
    environment: data.environment,
    thresholds: THRESHOLDS,
    technical_status: technicalStatus,
    institutional_status: approval,
    decision,
    dimensions: byDimension,
    criteria,
    failures: failed.map(({ dimension,id,description,observed,expected }) => ({
      dimension,id,description,observed,expected,
    })),
    guardrail:
      "Este gate no despliega producción. La aprobación institucional explícita es independiente del resultado técnico.",
  };

  const output = argValue("--output");
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (output) {
    const resolved = path.resolve(output);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, json, "utf8");
    console.log(`✓ Gate P9.6 generado: ${resolved}`);
  } else {
    process.stdout.write(json);
  }

  if (technicalStatus !== "PASS") process.exitCode = 2;
  if (process.argv.includes("--require-approval") && decision !== "APPROVED_FOR_PRODUCTION_PLANNING") {
    process.exitCode = 3;
  }
};

try {
  main();
} catch (error) {
  console.error(`✗ Gate P9.6 falló: ${error.message}`);
  process.exitCode = 1;
}
