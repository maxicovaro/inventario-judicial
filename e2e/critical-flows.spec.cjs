const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");
const sequelize = require("../src/config/database");
const {
  resetIntegrationData,
} = require("../scripts/integration-fixtures");

const PASSWORD = process.env.E2E_TEST_PASSWORD;
const USERS = {
  admin: process.env.E2E_ADMIN_EMAIL,
  responsable: process.env.E2E_RESPONSABLE_EMAIL,
  usuario: process.env.E2E_USUARIO_EMAIL,
};

if (!PASSWORD || !USERS.admin || !USERS.responsable || !USERS.usuario) {
  throw new Error("Faltan credenciales E2E en variables de entorno");
}

const uploadsDir = path.join(__dirname, "../storage/uploads");

const limpiarUploadsE2E = () => {
  if (!fs.existsSync(uploadsDir)) return;

  for (const file of fs.readdirSync(uploadsDir)) {
    if (file.includes("e2e-adjunto")) {
      fs.unlinkSync(path.join(uploadsDir, file));
    }
  }
};

const login = async (page, email, password = PASSWORD) => {
  await page.goto("/");
  await page.getByPlaceholder("Ingresá tu email").fill(email);
  await page.getByPlaceholder("Ingresá tu contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
};

const cambiarUsuario = async (page, email) => {
  await page.evaluate(() => {
    localStorage.clear();
  });
  await login(page, email);
};

test.beforeEach(async () => {
  limpiarUploadsE2E();
  await resetIntegrationData();
});

test.afterEach(() => {
  limpiarUploadsE2E();
});

test.afterAll(async () => {
  await sequelize.close();
});

test("un visitante sin sesión es redirigido al login", async ({ page }) => {
  await page.goto("/activos");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
});

test("credenciales inválidas muestran error sin crear sesión", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Ingresá tu email").fill(USERS.usuario);
  await page.getByPlaceholder("Ingresá tu contraseña").fill("credencial-no-valida");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(/Credenciales inválidas/i)).toBeVisible();
});

test("RESPONSABLE crea un activo propio y no entra a administración", async ({ page }) => {
  await login(page, USERS.responsable);
  await page.goto("/activos");

  await expect(page.getByRole("heading", { name: "Activos" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nuevo activo" })).toBeVisible();
  await expect(
    page.locator('input[disabled][value="Unidad Judicial N° 1"]'),
  ).toBeVisible();

  const categoria = page.locator('select[name="categoria_id"]');
  await expect
    .poll(async () => categoria.locator("option").count())
    .toBeGreaterThan(1);

  await page.getByPlaceholder("Código interno").fill("E2E-RESP-001");
  await page
    .locator('input[name="nombre"][placeholder="Nombre"]')
    .fill("Notebook creada desde Playwright");
  await page
    .locator('input[name="marca"][placeholder="Marca"]')
    .fill("Marca E2E");
  await categoria.selectOption({ index: 1 });
  await page.getByRole("button", { name: "Crear activo" }).click();

  await expect(page.getByText("Activo creado correctamente")).toBeVisible();

  const busqueda = page.getByPlaceholder(
    "Buscar por nombre, código, marca, modelo...",
  );
  await busqueda.fill("E2E-RESP-001");
  await expect(page.getByText("Notebook creada desde Playwright")).toBeVisible();

  await page.reload();
  const busquedaRecargada = page.getByPlaceholder(
    "Buscar por nombre, código, marca, modelo...",
  );
  await busquedaRecargada.fill("E2E-RESP-001");
  await expect(page.getByText("Notebook creada desde Playwright")).toBeVisible();

  await page.goto("/usuarios");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});

test("USUARIO consulta activos pero no recibe controles de gestión", async ({ page }) => {
  await login(page, USERS.usuario);
  await page.goto("/activos");

  await expect(page.getByRole("heading", { name: "Activos" })).toBeVisible();
  await expect(page.getByText("Equipo base E2E")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nuevo activo" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Crear activo" })).toBeHidden();

  await page.goto("/usuarios");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/reportes-pedidos");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("Admin General accede a gestión global", async ({ page }) => {
  await login(page, USERS.admin);

  await page.goto("/activos");
  await expect(page.getByRole("heading", { name: "Nuevo activo" })).toBeVisible();
  await expect(page.locator('select[name="oficina_id"]')).toBeVisible();

  await page.goto("/usuarios");
  await expect(page).toHaveURL(/\/usuarios$/);
  await expect(page.getByText(USERS.admin)).toBeVisible();

  await page.goto("/reportes-pedidos");
  await expect(page).toHaveURL(/\/reportes-pedidos$/);
  await expect(
    page.getByRole("heading", { name: "Reporte de pedidos" }),
  ).toBeVisible();
});

test("solicitud de oficina es revisada por Dirección", async ({ page }) => {
  const descripcion = "Solicitud E2E para revisión administrativa";

  await login(page, USERS.responsable);
  await page.goto("/solicitudes");
  await expect(page.getByRole("heading", { name: "Solicitudes" })).toBeVisible();

  await page.locator('textarea[name="descripcion"]').fill(descripcion);
  await page.locator('select[name="prioridad"]').selectOption("ALTA");
  await page.getByRole("button", { name: "Crear solicitud" }).click();
  await expect(page.getByText("Solicitud creada correctamente")).toBeVisible();

  const busqueda = page.getByPlaceholder(
    "Buscar por ID, descripción, usuario, oficina o activo...",
  );
  await busqueda.fill(descripcion);
  await expect(page.getByText(descripcion)).toBeVisible();
  await expect(page.getByText("PENDIENTE", { exact: true })).toBeVisible();

  await cambiarUsuario(page, USERS.admin);
  await page.goto("/solicitudes");

  const busquedaAdmin = page.getByPlaceholder(
    "Buscar por ID, descripción, usuario, oficina o activo...",
  );
  await busquedaAdmin.fill(descripcion);
  await expect(page.getByText(descripcion)).toBeVisible();
  await page.getByRole("button", { name: "Aprobar" }).click();

  await expect(page.getByText(/actualizada a APROBADA/)).toBeVisible();
  await expect(page.getByText("APROBADA", { exact: true })).toBeVisible();
});

test("pedido mensual se aprueba, provisiona y llega al reporte", async ({ page }) => {
  await login(page, USERS.responsable);
  await page.goto("/pedido-mensual");
  await expect(
    page.getByRole("heading", { name: "Pedido mensual de insumos" }),
  ).toBeVisible();

  const filaInsumo = page
    .getByRole("row")
    .filter({ hasText: "Resma A4 Integración" });
  await expect(filaInsumo).toBeVisible();
  await filaInsumo.locator('input[type="number"]').fill("5");
  await page
    .getByPlaceholder("Observaciones generales")
    .fill("Pedido E2E completo");
  await page.getByRole("button", { name: "Enviar pedido" }).click();
  await expect(page.getByText("Pedido enviado correctamente")).toBeVisible();

  await cambiarUsuario(page, USERS.admin);
  await page.goto("/historial-pedidos");
  await expect(
    page.getByRole("heading", { name: "Historial de pedidos mensuales" }),
  ).toBeVisible();

  await expect(page.getByText("ENVIADO", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Aprobar" }).click();
  await expect(page.getByText("APROBADO", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Ver detalle" }).click();
  await expect(page.getByText("Resma A4 Integración")).toBeVisible();

  const provision = page.locator('input[type="number"]');
  await expect(provision).toHaveCount(1);
  await provision.fill("5");

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("Provisión guardada correctamente");
    await dialog.accept();
  });

  await page
    .getByRole("button", { name: "Guardar provisión y marcar entregado" })
    .click();
  await expect(page.getByText("ENTREGADO", { exact: true })).toBeVisible();

  await page.goto("/reportes-pedidos");
  await expect(
    page.getByRole("heading", { name: "Reporte de pedidos" }),
  ).toBeVisible();
  await expect(page.getByText(/ENTREGADO:\s*1/)).toBeVisible();
  await expect(page.getByText(/Resma A4 Integración/)).toBeVisible();
});

test("adjunto se sube, lista y descarga desde navegador", async ({ page }) => {
  await login(page, USERS.responsable);
  await page.goto("/adjuntos");
  await expect(page.getByRole("heading", { name: "Adjuntos" })).toBeVisible();
  await expect(page.getByText("Error al cargar adjuntos")).toBeHidden();

  const activoSelect = page.locator("select").nth(0);
  await expect
    .poll(async () => activoSelect.locator("option").count())
    .toBeGreaterThan(1);
  await activoSelect.selectOption({
    label: "Equipo base E2E - E2E-BASE-001",
  });

  await page.locator("#archivo-input").setInputFiles({
    name: "e2e-adjunto.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% adjunto E2E\n"),
  });

  await page.getByRole("button", { name: "Subir adjunto" }).click();
  await expect(page.getByText("Adjunto subido correctamente")).toBeVisible();
  await expect(page.getByText(/e2e-adjunto\.pdf/)).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("e2e-adjunto.pdf");
});
