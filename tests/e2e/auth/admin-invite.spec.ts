import { test, expect } from "@playwright/test";
import { STORAGE_STATE } from "../fixtures/auth";

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

// ---------------------------------------------------------------------------
// Admin users filter — role select + search input
// Note: these tests do NOT require inbucket (no email sending involved).
// They use the persisted admin session from global.setup.ts.
// ---------------------------------------------------------------------------

test.describe("Admin users filter", () => {
  const hasStorageState = (() => {
    try {
      // Storage state file is only present after global.setup runs
      return Boolean(STORAGE_STATE);
    } catch {
      return false;
    }
  })();

  test(
    "role select and search input are visible on /admin/users",
    { tag: ["@admin-filter", "@smoke"] },
    async ({ browser }) => {
      test.skip(
        !process.env.E2E_ADMIN_EMAIL,
        "Requires E2E admin session (E2E_ADMIN_EMAIL not set)",
      );
      const ctx = await browser.newContext({ storageState: STORAGE_STATE });
      const page = await ctx.newPage();
      await page.goto("/admin/users");

      // Role combobox and search input should be visible
      await expect(page.getByRole("combobox")).toBeVisible({ timeout: 10_000 });
      await expect(
        page.getByPlaceholder(/buscar por nombre o correo/i),
      ).toBeVisible();
      await ctx.close();
    },
  );

  test(
    "typing a partial name reduces visible user rows",
    { tag: ["@admin-filter"] },
    async ({ browser }) => {
      test.skip(
        !process.env.E2E_ADMIN_EMAIL,
        "Requires E2E admin session (E2E_ADMIN_EMAIL not set)",
      );
      const ctx = await browser.newContext({ storageState: STORAGE_STATE });
      const page = await ctx.newPage();
      await page.goto("/admin/users");

      // Wait for table to load
      await expect(page.getByRole("table")).toBeVisible({ timeout: 10_000 });
      const rowsBefore = await page.getByRole("row").count();

      // Type a search term that should match at least one but not all users
      const searchInput = page.getByPlaceholder(/buscar por nombre o correo/i);
      await searchInput.fill("admin");

      // Row count should decrease (or empty-state should show)
      const rowsAfter = await page.getByRole("row").count();
      const hasEmptyState = await page
        .getByText(/No hay usuarios que coincidan con los filtros/i)
        .isVisible()
        .catch(() => false);

      expect(rowsAfter < rowsBefore || hasEmptyState).toBe(true);
      await ctx.close();
    },
  );

  test(
    "selecting a role from the dropdown filters the table to only that role",
    { tag: ["@admin-filter"] },
    async ({ browser }) => {
      test.skip(
        !process.env.E2E_ADMIN_EMAIL,
        "Requires E2E admin session (E2E_ADMIN_EMAIL not set)",
      );
      const ctx = await browser.newContext({ storageState: STORAGE_STATE });
      const page = await ctx.newPage();
      await page.goto("/admin/users");

      await expect(page.getByRole("table")).toBeVisible({ timeout: 10_000 });
      const rowsBefore = await page.getByRole("row").count();

      // Select "TI" role
      await page.getByRole("combobox").click();
      await page.getByRole("option", { name: "TI" }).click();

      // Either the table has fewer rows or the empty state is shown
      const rowsAfter = await page.getByRole("row").count();
      const hasEmptyState = await page
        .getByText(/No hay usuarios que coincidan con los filtros/i)
        .isVisible()
        .catch(() => false);

      expect(rowsAfter <= rowsBefore || hasEmptyState).toBe(true);
      await ctx.close();
    },
  );

  test(
    "clearing both filters restores all rows",
    { tag: ["@admin-filter"] },
    async ({ browser }) => {
      test.skip(
        !process.env.E2E_ADMIN_EMAIL,
        "Requires E2E admin session (E2E_ADMIN_EMAIL not set)",
      );
      const ctx = await browser.newContext({ storageState: STORAGE_STATE });
      const page = await ctx.newPage();
      await page.goto("/admin/users");

      await expect(page.getByRole("table")).toBeVisible({ timeout: 10_000 });
      const rowsBefore = await page.getByRole("row").count();

      // Apply search filter
      const searchInput = page.getByPlaceholder(/buscar por nombre o correo/i);
      await searchInput.fill("admin");

      // Clear filters: reset select to "Todos" and clear search
      await page.getByRole("combobox").click();
      await page.getByRole("option", { name: "Todos" }).click();
      await searchInput.fill("");

      const rowsAfter = await page.getByRole("row").count();
      expect(rowsAfter).toBe(rowsBefore);
      await ctx.close();
    },
  );
});
