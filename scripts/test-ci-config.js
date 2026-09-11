const assert = require("assert");
const fs = require("fs");

const workflow = fs.readFileSync(".github/workflows/quality.yml", "utf8");
const packageJson = require("../package.json");

assert.match(workflow, /pull_request:/);
assert.match(workflow, /branches:\s*\n\s*- main/);
assert.match(workflow, /mysql:8\.4/);
assert.match(workflow, /npm run db:setup/);
assert.match(workflow, /npm run db:migrate/);
assert.match(workflow, /npm run db:status/);
assert.match(workflow, /npm run check:backend/);
assert.match(workflow, /npm test/);
assert.match(workflow, /npm run test:runtime-health/);
assert.match(workflow, /npm run test:backup-restore/);
assert.match(workflow, /npm run lint/);
assert.match(workflow, /npm run build/);
assert.match(workflow, /node-version:\s*22/);

const auditCommands = workflow.match(/npm audit --audit-level=moderate/g) || [];
assert.strictEqual(auditCommands.length, 2);

const e2eStepMatch = workflow.match(
  /- name: Run critical browser E2E[\s\S]*?(?=\n\s{6}- name:|\n\s{2}frontend:)/,
);
assert.ok(e2eStepMatch, "No se encontró el paso E2E crítico en CI");
const e2eStep = e2eStepMatch[0];
assert.match(
  e2eStep,
  /AUTH_TOKEN_TRANSPORT:\s*cookie/,
  "Los E2E deben ejecutar el backend con cookie HttpOnly",
);
assert.match(
  e2eStep,
  /REQUIRE_ADMIN_MFA:\s*true/,
  "Los E2E deben exigir MFA de ADMIN",
);
assert.match(
  e2eStep,
  /MFA_ENCRYPTION_KEY:\s*[A-Za-z0-9+/=]+/,
  "Los E2E deben proporcionar una clave MFA de test",
);

assert.ok(packageJson.scripts["test:dependencies"]);
assert.ok(packageJson.scripts["test:operational-contracts"]);
assert.ok(packageJson.scripts["test:recovery-runbook"]);
assert.ok(packageJson.scripts["test:backup-restore"]);
assert.ok(packageJson.scripts["test:runtime-health"]);
assert.ok(packageJson.scripts["test:ci-config"]);

console.log("Configuración de CI validada correctamente.");
