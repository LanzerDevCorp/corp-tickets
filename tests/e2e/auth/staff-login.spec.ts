import { test, expect } from "@playwright/test";
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } from "../fixtures/auth";

test.describe("Staff login flow", () => {
  test("admin logs in and is redirected to /dashboard", async ({ page }) => {
    await page.goto("/auth/login");

    await page.fill('[name="email"]', E2E_ADMIN_EMAIL);
    await page.fill('[name="password"]', E2E_ADMIN_PASSWORD);
    await page.click('[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("wrong password shows error and no redirect", async ({ page }) => {
    await page.goto("/auth/login");

    await page.fill('[name="email"]', E2E_ADMIN_EMAIL);
    await page.fill('[name="password"]', "wrongpassword");
    await page.click('[type="submit"]');

    await expect(page.getByText(/credenciales inválidas/i)).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("unauthenticated access to /dashboard redirects to /auth/login", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("logout clears session and redirects to /", async ({ page }) => {
    await page.goto("/auth/login");
    await page.fill('[name="email"]', E2E_ADMIN_EMAIL);
    await page.fill('[name="password"]', E2E_ADMIN_PASSWORD);
    await page.click('[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);

    await page.click('button:has-text("Cerrar sesión")');
    // logoutUser() redirects to "/" but middleware may redirect to /auth/login
    await expect(page).toHaveURL(/\/(auth\/login)?$/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
