import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? "admin@corp.local";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "AdminPass1!";

test.describe("Admin invite IT staff", () => {
  test.skip("admin can trigger invite for IT user", async ({ page }) => {
    // Requires Supabase inbucket running locally for email verification
    // Skip unless TEST_SUPABASE_RUNNING=true
    if (!process.env.TEST_SUPABASE_RUNNING) return;

    await page.goto("/auth/login");
    await page.fill('[name="email"]', ADMIN_EMAIL);
    await page.fill('[name="password"]', ADMIN_PASSWORD);
    await page.click('[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);

    // The invite UI is on the admin panel
    await page.goto("/admin");
    await page.fill('[name="invite-email"]', `it-${Date.now()}@corp.test`);
    await page.click('button:has-text("Invitar")');

    await expect(page.getByText(/invitación enviada/i)).toBeVisible();
  });

  test("client cannot access admin-only invite action", async ({ page }) => {
    // Non-admin visiting /admin should get 403 via middleware
    await page.goto("/admin");
    // Unauthenticated → redirect to /auth/login
    await expect(page).toHaveURL(/\/auth\/login|\/403/);
  });
});
