import { expect, test, type Page } from "@playwright/test";
import { STORAGE_STATE } from "./fixtures/auth";
import {
  ensureCategory,
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
