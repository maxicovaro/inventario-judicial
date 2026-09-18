const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const assertIncludes = (relativePath, fragments) => {
  const content = read(relativePath);
  for (const fragment of fragments) {
    if (!content.includes(fragment)) {
      throw new Error(
        `Contrato P9.3 incumplido: ${relativePath} no contiene: ${fragment}`,
      );
    }
  }
};

assertIncludes("docs/P9_3_ADMIN_PROCEDURE.md", [
  "# P9.3 — Procedimiento operativo de administración",
  "## 2. Matriz operativa mínima",
  "## 4. Gestión de usuarios — Dirección",
  "## 5. Bienes patrimoniales",
  "### Baja",
  "## 6. Insumos y stock",
  "## 7. Movimientos de stock",
  "## 8. Solicitudes y pedidos",
  "COMPLEMENTARIO",
  "provisión 0",
  "## 9. Adjuntos",
  "10 MB",
  "## 10. Backups y tareas rutinarias",
  "## 13. Condiciones de stop",
  "## 15. Validación de P9.3",
]);

assertIncludes("src/routes/usuarioRoutes.js", [
  "verificarAdminGeneral",
  'router.get("/", verificarToken, verificarAdminGeneral, listarUsuarios)',
]);

assertIncludes("src/routes/activoRoutes.js", [
  "verificarGestionOficina",
  "verificarAdminGeneral",
  '"/:id/baja"',
]);

assertIncludes("src/routes/depositoRoutes.js", [
  "verificarGestionDeposito",
  "validarEntregaConProvision",
  '"/pedidos/:id/proveer"',
]);

assertIncludes("src/routes/stockOficinaRoutes.js", [
  "verificarAdminGeneral",
  '"/asignar"',
]);

assertIncludes("src/middlewares/uploadMiddleware.js", [
  "10 * 1024 * 1024",
  '"application/pdf"',
  '"image/jpeg"',
]);

assertIncludes("docs/OPERATIONS.md", [
  "npm run db:backup",
  "npm run db:backup:verify",
  "npm run db:restore",
  "GET /health/ready",
]);

console.log("✓ Contratos P9.3 de procedimiento administrativo verificados.");
