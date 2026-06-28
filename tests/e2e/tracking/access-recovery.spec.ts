import { test, expect } from "@playwright/test";

test.describe("Track access recovery", () => {
  test("muestra formulario al acceder con session_expired", async ({ page }) => {
    await page.goto("/track/access?error_code=session_expired");

    await expect(page.getByLabel(/correo electrónico/i)).toBeVisible();
    await expect(page.getByLabel(/número de ticket/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /entrar al ticket/i })).toBeVisible();
  });

  test("muestra formulario al acceder directamente sin error_code", async ({ page }) => {
    await page.goto("/track/access");

    await expect(page.getByLabel(/correo electrónico/i)).toBeVisible();
    await expect(page.getByLabel(/número de ticket/i)).toBeVisible();
  });

  test("pre-rellena campos desde query params", async ({ page }) => {
    await page.goto(
      "/track/access?error_code=session_expired&ref=6087BB67&email=cliente%40ejemplo.com"
    );

    await expect(page.locator('input[value="6087BB67"]')).toBeVisible();
    await expect(page.locator('input[value="cliente@ejemplo.com"]')).toBeVisible();
  });

  test("muestra copy neutro sin error_code", async ({ page }) => {
    await page.goto("/track/access");

    await expect(page.getByText(/consultar tu ticket/i)).toBeVisible();
  });

  test("muestra copy de sesión expirada con session_expired", async ({ page }) => {
    await page.goto("/track/access?error_code=session_expired");

    await expect(page.getByText(/continuar seguimiento/i)).toBeVisible();
  });

  test("el link Enviar ticket navega a la home", async ({ page }) => {
    await page.goto("/track/access");

    const submitLink = page.getByRole("link", { name: /enviar ticket/i });
    await expect(submitLink).toBeVisible();
    await expect(submitLink).toHaveAttribute("href", "/");
  });
});
