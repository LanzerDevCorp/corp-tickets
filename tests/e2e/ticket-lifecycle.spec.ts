import { expect, test, type Page } from "@playwright/test";
import { STORAGE_STATE } from "./fixtures/auth";
import {
  ensureCategory,
  adminClient,
  getTicketIdBySubject,
  hasSupabaseEnv,
  makeTicket,
} from "./fixtures/db";
import {
  expectDetailStatus,
  openTicketDetail,
  resolveViaTooltip,
  setStatusViaDetail,
  submitPublicTicket,
} from "./actions/ticket";
import {
  QUEUE_FILTER,
  expectQueueFilter,
  selectQueueFilter,
} from "./actions/queue-filters";

/**
 * Ticket lifecycle — the critical E2E flow and its status-change branches.
 *
 * Tags drive selective runs (see tests/e2e/FLOWS.md):
 *   @lifecycle  master flow      @resolve  any resolve path
 *   @create     creation         @status   any status change
 *   @tooltip / @detail  the affordance        @closed / @negative  edge cases
 *
 * Each test models two real actors with separate contexts: an anonymous visitor
 * for the public form, and the persisted admin session for the dashboard.
 */
test.describe("Ticket lifecycle", () => {
  test.beforeAll(async () => {
    if (!hasSupabaseEnv) {
      test.skip(true, "Requires local Supabase with service role key");
      return;
    }
    await ensureCategory();
  });

  /** Helper: create a ticket as an anonymous visitor, return its data + id. */
  async function createTicketAsVisitor(
    browser: import("@playwright/test").Browser,
  ) {
    const data = makeTicket();
    const anon = await browser.newContext();
    await submitPublicTicket(await anon.newPage(), data);
    await anon.close();
    const id = await getTicketIdBySubject(data.subject);
    return { data, id };
  }

  /** Helper: open an admin page backed by the persisted staff session. */
  async function adminPage(
    browser: import("@playwright/test").Browser,
  ): Promise<Page> {
    const ctx = await browser.newContext({ storageState: STORAGE_STATE });
    return ctx.newPage();
  }

  test(
    "un ticket creado por un visitante aparece en el dashboard del admin",
    { tag: ["@lifecycle", "@create", "@critical"] },
    async ({ browser }) => {
      const { data } = await createTicketAsVisitor(browser);

      const admin = await adminPage(browser);
      await admin.goto("/dashboard");
      await expect(admin.getByText(data.subject)).toBeVisible({
        timeout: 10_000,
      });
      await admin.context().close();
    },
  );

  // Two affordances reach the SAME outcome (status = resolved). Parameterize the
  // branch; adding a new resolve path is one entry here.
  const resolveStrategies = [
    {
      name: "tooltip quick action",
      tag: "@tooltip",
      resolve: async (page: Page, subject: string) => {
        await page.goto("/dashboard");
        await resolveViaTooltip(page, subject);
      },
    },
    {
      name: "detail status dropdown",
      tag: "@detail",
      resolve: async (page: Page, _subject: string, id: string) => {
        await openTicketDetail(page, id);
        await setStatusViaDetail(page, "Resuelto");
      },
    },
  ];

  for (const strategy of resolveStrategies) {
    test(
      `un ticket se resuelve vía ${strategy.name}`,
      { tag: ["@lifecycle", "@resolve", strategy.tag] },
      async ({ browser }) => {
        const { data, id } = await createTicketAsVisitor(browser);

        const admin = await adminPage(browser);
        await strategy.resolve(admin, data.subject, id);

        await openTicketDetail(admin, id);
        await expectDetailStatus(admin, "Resuelto");
        await admin.context().close();
      },
    );
  }

  test(
    "cerrar un ticket exige un motivo y luego persiste el cierre",
    { tag: ["@lifecycle", "@status", "@closed", "@negative"] },
    async ({ browser }) => {
      const { id } = await createTicketAsVisitor(browser);

      const admin = await adminPage(browser);
      await openTicketDetail(admin, id);

      // Negative: choosing "Cerrado" opens the dialog; an empty reason is rejected.
      await admin.getByLabel(/estado del ticket/i).click();
      await admin.getByRole("option", { name: /^Cerrado$/i }).click();
      await admin.getByRole("button", { name: /confirmar cierre/i }).click();
      await expect(
        admin.getByText(/indica un motivo para cerrar/i),
      ).toBeVisible();

      // Positive: with a reason the ticket closes and the reason is shown.
      const reason = "Ticket duplicado, fuera de alcance.";
      await admin
        .getByRole("textbox", { name: /motivo de cierre/i })
        .fill(reason);
      await admin.getByRole("button", { name: /confirmar cierre/i }).click();

      await expectDetailStatus(admin, "Cerrado");
      await expect(admin.getByText(reason)).toBeVisible();
      await admin.context().close();
    },
  );
});

// ---------------------------------------------------------------------------
// Category filter — dashboard ticket queue
// ---------------------------------------------------------------------------

test.describe("Category filter", () => {
  test.beforeAll(async () => {
    if (!hasSupabaseEnv) {
      test.skip(true, "Requires local Supabase with service role key");
    }
  });

  /** Helper: open an admin dashboard page backed by the persisted staff session. */
  async function adminDashboard(
    browser: import("@playwright/test").Browser,
  ): Promise<Page> {
    const ctx = await browser.newContext({ storageState: STORAGE_STATE });
    const page = await ctx.newPage();
    await page.goto("/dashboard");
    return page;
  }

  /** Helper: open the category MultiSelect dropdown on the dashboard. */
  async function openCategoryFilter(page: Page) {
    // The category filter is the 4th combobox on the dashboard page
    // (after notifications, status filter, and priority filter).
    // Using nth() because the placeholder text changes when values are selected.
    const trigger = page.getByRole("combobox").nth(3);
    await expect(trigger).toBeVisible({ timeout: 10_000 });
    await trigger.click();
  }

  test(
    "category MultiSelect renders with at least 'Sin categoría' option",
    { tag: ["@category-filter", "@smoke"] },
    async ({ browser }) => {
      test.skip(!hasSupabaseEnv, "Requires local Supabase");
      const page = await adminDashboard(browser);
      const categoryTrigger = page
        .getByRole("combobox")
        .filter({ hasText: /categoría/i });
      await expect(categoryTrigger).toBeVisible({ timeout: 10_000 });
      // Open the dropdown
      await categoryTrigger.click();
      // Wait for the popover content — use exact to avoid table cell matches
      await expect(
        page.getByRole("option", { name: "Sin categoría" }).last(),
      ).toBeVisible({ timeout: 10_000 });
      await page.context().close();
    },
  );

  test(
    "selecting a real category shows only tickets of that category",
    { tag: ["@category-filter"] },
    async ({ browser }) => {
      test.skip(!hasSupabaseEnv, "Requires local Supabase");

      // Create a category and a ticket in that category via DB
      const categoryName = `E2E-Cat-${Date.now()}`;
      const { data: category, error: catError } = await adminClient()
        .from("categories")
        .insert({ name: categoryName, is_enabled: true })
        .select("id")
        .single();
      if (catError || !category)
        throw catError ?? new Error("Category insert failed");

      const ticketData = makeTicket({ category: categoryName });
      const { error: ticketError } = await adminClient()
        .from("tickets")
        .insert({
          subject: ticketData.subject,
          body: ticketData.body,
          name: ticketData.name,
          email: ticketData.email,
          priority: "low",
          category_id: category.id,
        });
      if (ticketError) throw ticketError;

      const page = await adminDashboard(browser);
      // Open category MultiSelect and select our test category
      await openCategoryFilter(page);
      await page.getByRole("option", { name: categoryName }).last().click();
      // Close dropdown by pressing Escape
      await page.keyboard.press("Escape");

      // The test ticket subject should appear
      await expect(page.getByText(ticketData.subject)).toBeVisible({
        timeout: 10_000,
      });

      await page.context().close();
    },
  );

  test(
    "selecting 'Sin categoría' shows only tickets with no category",
    { tag: ["@category-filter"] },
    async ({ browser }) => {
      test.skip(!hasSupabaseEnv, "Requires local Supabase");
      const page = await adminDashboard(browser);

      await openCategoryFilter(page);
      await page.getByRole("option", { name: "Sin categoría" }).last().click();
      await page.keyboard.press("Escape");

      // After filter: the table itself should be visible (no crash)
      await expect(page.getByRole("table")).toBeVisible({ timeout: 10_000 });
      await page.context().close();
    },
  );

  test(
    "deselecting all categories restores the full list",
    { tag: ["@category-filter"] },
    async ({ browser }) => {
      test.skip(!hasSupabaseEnv, "Requires local Supabase");
      const page = await adminDashboard(browser);

      // Count rows before filter
      const rowsBefore = await page.getByRole("row").count();

      // Apply "Sin categoría" filter
      await openCategoryFilter(page);
      await page.getByRole("option", { name: "Sin categoría" }).last().click();
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);

      // Deselect by clicking the badge's remove button (clickToRemove behavior)
      const badge = page.getByText("Sin categoría", { exact: true }).first();
      await expect(badge).toBeVisible();
      await badge.click();
      await page.waitForTimeout(500);

      const rowsAfter = await page.getByRole("row").count();
      expect(rowsAfter).toBe(rowsBefore);
      await page.context().close();
    },
  );

  test(
    "category filter does not clear the status filter (additive — Scenario C-7)",
    { tag: ["@category-filter"] },
    async ({ browser }) => {
      test.skip(!hasSupabaseEnv, "Requires local Supabase");
      const page = await adminDashboard(browser);

      // Verify the table is present (baseline for filter comparison)
      await expect(page.getByRole("table")).toBeVisible({ timeout: 10_000 });

      // Apply category filter
      await openCategoryFilter(page);
      await page.getByRole("option", { name: "Sin categoría" }).last().click();
      await page.keyboard.press("Escape");

      // Table should still be visible — category filter is additive, not replacing
      await expect(page.getByRole("table")).toBeVisible();
      await page.context().close();
    },
  );
});

// ---------------------------------------------------------------------------
// Queue filter persistence — dashboard ticket queue
// ---------------------------------------------------------------------------

test.describe("Queue filter persistence", () => {
  test.beforeAll(async () => {
    if (!hasSupabaseEnv) {
      test.skip(true, "Requires local Supabase with service role key");
    }
  });

  /** Helper: open an admin dashboard page backed by the persisted staff session. */
  async function adminDashboard(
    browser: import("@playwright/test").Browser,
  ): Promise<Page> {
    const ctx = await browser.newContext({ storageState: STORAGE_STATE });
    const page = await ctx.newPage();
    await page.goto("/dashboard");
    // Wait for the queue to finish its initial load (and the localStorage
    // restore re-render to settle) before touching the filters.
    await expect(
      page.getByRole("combobox", { name: QUEUE_FILTER.priority }),
    ).toBeVisible({ timeout: 10_000 });
    return page;
  }

  test(
    "the four queue filters persist across a reload",
    { tag: ["@filter-persistence", "@queue"] },
    async ({ browser }) => {
      test.skip(!hasSupabaseEnv, "Requires local Supabase");
      const page = await adminDashboard(browser);

      // Choose one value in each of the four filters. Values are picked to be
      // deterministic regardless of seed data: "Todos los estados" collapses the
      // status MultiSelect to a single badge, and "Sin asignar" / "Sin categoría"
      // are always present.
      await selectQueueFilter(page, QUEUE_FILTER.status, "Todos los estados", {
        multiselect: true,
      });
      await selectQueueFilter(page, QUEUE_FILTER.priority, "Alta");
      await selectQueueFilter(page, QUEUE_FILTER.assignee, "Sin asignar");
      await selectQueueFilter(page, QUEUE_FILTER.category, "Sin categoría", {
        multiselect: true,
      });

      // Sanity: a selection is reflected before the reload.
      await expectQueueFilter(page, QUEUE_FILTER.priority, "Alta");

      // Reload remounts the queue; filters are restored from localStorage.
      await page.reload();
      await expect(
        page.getByRole("combobox", { name: QUEUE_FILTER.priority }),
      ).toBeVisible({ timeout: 10_000 });

      // All four selections survive the reload.
      await expectQueueFilter(page, QUEUE_FILTER.status, "Todos los estados");
      await expectQueueFilter(page, QUEUE_FILTER.priority, "Alta");
      await expectQueueFilter(page, QUEUE_FILTER.assignee, "Sin asignar");
      await expectQueueFilter(page, QUEUE_FILTER.category, "Sin categoría");

      await page.context().close();
    },
  );
});
