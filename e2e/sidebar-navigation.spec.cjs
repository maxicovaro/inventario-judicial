const { test, expect } = require("@playwright/test");

const PASSWORD = process.env.E2E_TEST_PASSWORD;
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;

if (!PASSWORD || !ADMIN_EMAIL) {
  throw new Error("Faltan credenciales E2E para probar la navegación lateral");
}

const loginAdmin = async (page) => {
  await page.goto("/");
  await page.getByPlaceholder("Ingresá tu email").fill(ADMIN_EMAIL);
  await page.getByPlaceholder("Ingresá tu contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
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
