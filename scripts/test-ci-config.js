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
assert.match(workflow, /npm run lint/);
assert.match(workflow, /npm run build/);
assert.match(workflow, /node-version:\s*22/);
assert.ok(packageJson.scripts["test:ci-config"]);

console.log("Configuración de CI validada correctamente.");
