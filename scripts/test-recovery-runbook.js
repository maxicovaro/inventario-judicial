const assert = require("assert");
const fs = require("fs");

const runbook = fs.readFileSync("docs/OPERATIONS.md", "utf8");
const roadmap = fs.readFileSync("ROADMAP.md", "utf8");
const gitignore = fs.readFileSync(".gitignore", "utf8");
const backup = fs.readFileSync("scripts/db-backup.js", "utf8");
const restore = fs.readFileSync("scripts/db-restore.js", "utf8");
const workflow = fs.readFileSync(".github/workflows/quality.yml", "utf8");

assert.match(roadmap, /P3 — Resiliencia operativa y recuperación ✅/);
assert.match(runbook, /RPO objetivo/);
assert.match(runbook, /RTO objetivo/);
assert.match(runbook, /npm run db:backup/);
assert.match(runbook, /npm run db:backup:verify/);
assert.match(runbook, /npm run db:restore/);
assert.match(runbook, /GET \/health\/live/);
assert.match(runbook, /GET \/health\/ready/);
assert.match(runbook, /X-Request-Id/);
assert.match(runbook, /SIGTERM/);
assert.match(runbook, /SEV-1/);
assert.match(runbook, /Rollback de aplicación/);
assert.match(runbook, /copia fuera del host/i);
assert.match(gitignore, /^backups\/$/m);
assert.match(backup, /sha256File/);
assert.match(backup, /single-transaction/);
assert.match(restore, /--confirm/);
assert.match(restore, /ALLOW_RESTORE_CURRENT_DB/);
assert.match(restore, /normalizedTarget === normalizedSource/);
assert.match(restore, /SYSTEM_DATABASES\.has\(normalizedTarget\)/);
assert.match(restore, /information_schema/);
assert.match(restore, /performance_schema/);
assert.match(workflow, /npm run test:runtime-health/);
assert.match(workflow, /npm run test:backup-restore/);

console.log("Runbook y controles de recuperación operativa validados correctamente.");
