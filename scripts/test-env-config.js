const assert = require("assert");
const fs = require("fs");

const backendExample = fs.readFileSync(".env.example", "utf8");
const stagingExample = fs.readFileSync(".env.staging.example", "utf8");
const frontendAxios = fs.readFileSync(
  "inventario-frontend/src/api/axios.js",
  "utf8",
);
const frontendExample = fs.readFileSync(
  "inventario-frontend/.env.example",
  "utf8",
);
const frontendStagingExample = fs.readFileSync(
  "inventario-frontend/.env.staging.example",
  "utf8",
);
const envConfig = fs.readFileSync("src/config/env.js", "utf8");

assert.match(backendExample, /NODE_ENV=development/);
assert.match(backendExample, /DEPLOY_ENV=development/);
assert.match(backendExample, /JWT_SECRET=/);
assert.doesNotMatch(backendExample, /Admin1234/);
assert.match(stagingExample, /NODE_ENV=production/);
assert.match(stagingExample, /DEPLOY_ENV=staging/);
assert.match(stagingExample, /AUTH_TOKEN_TRANSPORT=cookie/);
assert.match(frontendAxios, /import\.meta\.env\.VITE_API_URL/);
assert.doesNotMatch(frontendAxios, /localhost:3000/);
assert.match(frontendExample, /VITE_API_URL=/);
assert.match(
  frontendStagingExample,
  /VITE_API_URL=(?:https:\/\/[^\s]+|\/api)/,
  "staging debe usar una API HTTPS absoluta o /api detrás de un proxy same-origin",
);
assert.match(envConfig, /Falta la variable de entorno requerida/);
assert.match(envConfig, /CORS_ORIGIN/);
assert.match(envConfig, /DEPLOY_ENV/);
assert.match(envConfig, /DEPLOY_REVISION/);

console.log("Configuración por ambientes validada correctamente.");
