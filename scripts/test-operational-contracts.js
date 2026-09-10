const assert = require("assert");
const fs = require("fs");

const app = fs.readFileSync("src/app.js", "utf8");
const server = fs.readFileSync("server.js", "utf8");
const health = fs.readFileSync("src/routes/healthRoutes.js", "utf8");
const requestContext = fs.readFileSync("src/middlewares/requestContext.js", "utf8");
const logger = fs.readFileSync("src/utils/logger.js", "utf8");
const env = fs.readFileSync("src/config/env.js", "utf8");
const envExample = fs.readFileSync(".env.example", "utf8");
const safeErrors = fs.readFileSync("src/middlewares/safeErrorResponses.js", "utf8");

assert.match(app, /app\.use\(requestContext\)/);
assert.match(app, /app\.use\("\/health", healthRoutes\)/);
assert.match(health, /router\.get\("\/live"/);
assert.match(health, /router\.get\("\/ready"/);
assert.match(health, /sequelize\.query\("SELECT 1"/);
assert.match(health, /status\(503\)/);
assert.match(requestContext, /X-Request-Id/);
assert.match(requestContext, /crypto\.randomUUID\(\)/);
assert.match(requestContext, /http_request_completed/);
assert.doesNotMatch(requestContext, /req\.body|req\.query/);
assert.match(logger, /JSON\.stringify/);
assert.match(safeErrors, /http_unhandled_error/);
assert.match(safeErrors, /request_id/);
assert.match(server, /SIGTERM/);
assert.match(server, /SIGINT/);
assert.match(server, /server\.close/);
assert.match(server, /sequelize\.close\(\)/);
assert.match(server, /SHUTDOWN_TIMEOUT_MS/);
assert.match(env, /HEALTH_DB_TIMEOUT_MS/);
assert.match(env, /SHUTDOWN_TIMEOUT_MS/);
assert.match(envExample, /HEALTH_DB_TIMEOUT_MS=2000/);
assert.match(envExample, /SHUTDOWN_TIMEOUT_MS=10000/);

console.log("Contratos de health, observabilidad y shutdown validados correctamente.");
