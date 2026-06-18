import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? "admin@corp.local";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "AdminPass1!";

test.describe("Staff login flow", () => {
  test("admin logs in and is redirected to /dashboard", async ({ page }) => {
    await page.goto("/auth/login");

    await page.fill('[name="email"]', ADMIN_EMAIL);
    await page.fill('[name="password"]', ADMIN_PASSWORD);
    await page.click('[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("wrong password shows error and no redirect", async ({ page }) => {
    await page.goto("/auth/login");

    await page.fill('[name="email"]', ADMIN_EMAIL);
    await page.fill('[name="password"]', "wrongpassword");
    await page.click('[type="submit"]');

    await expect(page.getByText(/invalid credentials/i)).toBeVisible();
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
    await page.fill('[name="email"]', ADMIN_EMAIL);
    await page.fill('[name="password"]', ADMIN_PASSWORD);
    await page.click('[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);

    await page.click('button:has-text("Logout")');
    await expect(page).toHaveURL("/");

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
