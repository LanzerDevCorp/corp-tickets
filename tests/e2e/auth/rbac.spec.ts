import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? "admin@corp.local";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "AdminPass1!";

test.describe("Role-Based Access Control", () => {
  test("unauthenticated user is redirected to /auth/login from /dashboard", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("unauthenticated user is redirected to /auth/login from /admin", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("admin can access /dashboard", async ({ page }) => {
    await page.goto("/auth/login");
    await page.fill('[name="email"]', ADMIN_EMAIL);
    await page.fill('[name="password"]', ADMIN_PASSWORD);
    await page.click('[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test.skip("client is redirected to /403 from /dashboard", async ({
    page,
  }) => {
    // Requires a test client account + magic link session setup
    // Skip unless TEST_CLIENT_SESSION is configured
    if (!process.env.TEST_CLIENT_EMAIL) return;

    // Would need to establish a client session here via magic link
    // then navigate to /dashboard and expect /403
    await expect(page).toHaveURL(/\/403/);
  });
});
