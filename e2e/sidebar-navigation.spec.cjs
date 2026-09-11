const { test, expect } = require("@playwright/test");
const { totpAt } = require("../src/utils/mfa");

const PASSWORD = process.env.E2E_TEST_PASSWORD;
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;

if (!PASSWORD || !ADMIN_EMAIL) {
  throw new Error("Faltan credenciales E2E para probar la navegación lateral");
}

const completarMfaInicialSiCorresponde = async (page) => {
  const setupHeading = page.getByRole("heading", {
    name: "Protegé tu cuenta administrativa",
  });

  const requiereSetup = await setupHeading
    .waitFor({ state: "visible", timeout: 5000 })
    .then(() => true)
    .catch(() => false);

  if (!requiereSetup) return;

  const secret = String(
    (await page.locator(".auth-secret-box code").textContent()) || "",
  ).trim();
  expect(secret).toMatch(/^[A-Z2-7]{20,}$/);

  await page
    .getByLabel("Código de verificación")
    .fill(totpAt(secret, Date.now()));
  await page.getByRole("button", { name: "Activar verificación" }).click();

  await expect(
    page.getByRole("heading", { name: "Guardá tus códigos de recuperación" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ya los guardé, continuar" }).click();
};

const loginAdmin = async (page) => {
  await page.goto("/");
  await page.getByPlaceholder("Ingresá tu email").fill(ADMIN_EMAIL);
  await page.getByPlaceholder("Ingresá tu contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();

  await completarMfaInicialSiCorresponde(page);
  await expect(page).toHaveURL(/\/dashboard$/);
};

test("el sidebar conserva la posición y mantiene visible la opción activa", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await loginAdmin(page);

  const sidebar = page.locator(".app-sidebar-nav");
  await expect(sidebar).toBeVisible();

  await sidebar.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event("scroll"));
  });

  const scrollAntes = await sidebar.evaluate((element) => element.scrollTop);
  expect(scrollAntes).toBeGreaterThan(0);

  const bitacora = page.getByRole("link", { name: "Bitácora" });
  await expect(bitacora).toBeVisible();
  await bitacora.click();

  await expect(page).toHaveURL(/\/bitacora$/);

  const sidebarDespues = page.locator(".app-sidebar-nav");
  const activo = page.locator('.app-nav-link[aria-current="page"]');

  await expect(activo).toContainText("Bitácora");
  await expect(activo).toBeInViewport();

  const scrollDespues = await sidebarDespues.evaluate(
    (element) => element.scrollTop,
  );
  expect(scrollDespues).toBeGreaterThan(0);
});
