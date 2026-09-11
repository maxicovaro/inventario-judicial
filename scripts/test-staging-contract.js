const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const assertIncludes = (content, expected, label) => {
  if (!content.includes(expected)) {
    throw new Error(`Contrato staging inválido: falta ${label}`);
  }
  console.log(`OK - ${label}`);
};

const envConfig = read("src/config/env.js");
const uploadMiddleware = read("src/middlewares/uploadMiddleware.js");
const envExample = read(".env.example");
const backendDockerfile = read("Dockerfile");
const backendDockerignore = read(".dockerignore");
const frontendDockerfile = read("inventario-frontend/Dockerfile");
const caddyfile = read("inventario-frontend/Caddyfile");

assertIncludes(envConfig, "UPLOAD_DIR:", "UPLOAD_DIR en configuración de ambiente");
assertIncludes(
  uploadMiddleware,
  "env.UPLOAD_DIR",
  "uploads configurables por ambiente",
);
assertIncludes(
  uploadMiddleware,
  "../../storage/uploads",
  "fallback local de uploads preservado",
);
assertIncludes(envExample, "# UPLOAD_DIR=", "UPLOAD_DIR documentado");

assertIncludes(backendDockerfile, "FROM node:22-alpine", "Node 22 en backend");
assertIncludes(
  backendDockerfile,
  "npm run db:migrate && npm start",
  "migraciones antes del arranque backend",
);
assertIncludes(
  backendDockerignore,
  "storage/uploads",
  "uploads fuera de la imagen backend",
);

assertIncludes(frontendDockerfile, "FROM node:22-alpine", "Node 22 en build frontend");
assertIncludes(frontendDockerfile, "VITE_API_URL=/api", "API same-origin en build frontend");
assertIncludes(caddyfile, "handle /api/*", "proxy /api del frontend");
assertIncludes(caddyfile, "handle /health/*", "proxy de health backend");
assertIncludes(
  caddyfile,
  "reverse_proxy {$BACKEND_INTERNAL_URL}",
  "backend privado configurable",
);
assertIncludes(caddyfile, "handle /frontend-health", "healthcheck propio del frontend");
assertIncludes(caddyfile, "try_files {path} /index.html", "fallback SPA del frontend");

console.log("\n✓ Contrato estático de P7 staging validado.");
