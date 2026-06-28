import { expect, type Page } from "@playwright/test";
import type { TicketData } from "../fixtures/db";

/**
 * Reusable ticket actions ("skills") — one function per affordance so flows and
 * branches compose them instead of duplicating selectors. Author new ones here
 * via the Playwright MCP, then reference them from specs.
 */

/** Public form: fill and submit a ticket as an anonymous visitor. */
export async function submitPublicTicket(page: Page, data: TicketData) {
  await page.goto("/");
  await page.getByLabel(/nombre/i).fill(data.name);
  await page.getByLabel(/correo electrónico/i).fill(data.email);
  await page.getByLabel(/asunto/i).fill(data.subject);

  await page.getByRole("combobox", { name: /categoría/i }).click();
  await page
    .getByRole("option", { name: new RegExp(data.category, "i") })
    .click();
  await page
    .getByRole("radio", { name: new RegExp(`^${data.priority}$`, "i") })
    .click();

  await page.getByLabel(/describe tu problema/i).fill(data.body);
  await page.getByRole("button", { name: /enviar ticket/i }).click();

  await expect(
    page.getByRole("heading", { name: /ticket recibido/i }),
  ).toBeVisible({ timeout: 10_000 });
}

/** Dashboard queue: resolve a ticket via the hover-card "Mark as resolved" quick action. */
export async function resolveViaTooltip(page: Page, subject: string) {
  await page.getByRole("link", { name: subject }).hover();
  const button = page.getByRole("button", { name: /mark as resolved/i });
  await expect(button).toBeVisible();
  // The queue does not optimistically refetch, so sync on the server action
  // response (a Next server action POST) instead of a UI change.
  await Promise.all([
    page.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        r.request().headers()["next-action"] !== undefined,
    ),
    button.click(),
  ]);
}

/** Navigate to a ticket's detail page and wait for the status control. */
export async function openTicketDetail(page: Page, ticketId: string) {
  await page.goto(`/dashboard/tickets/${ticketId}`);
  await expect(page.getByLabel(/estado del ticket/i)).toBeVisible();
}

type SetStatusOptions = { closureReason?: string };

/**
 * Detail page: change status via the dropdown. For "Cerrado" a closure dialog
 * opens; pass `closureReason` to confirm it (omit to leave the dialog open, e.g.
 * to assert the empty-reason validation).
 */
export async function setStatusViaDetail(
  page: Page,
  label: string,
  options: SetStatusOptions = {},
) {
  await page.getByLabel(/estado del ticket/i).click();
  await page
    .getByRole("option", { name: new RegExp(`^${label}$`, "i") })
    .click();

  if (/^cerrado$/i.test(label)) {
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    if (options.closureReason) {
      await page
        .getByRole("textbox", { name: /motivo de cierre/i })
        .fill(options.closureReason);
      await page.getByRole("button", { name: /confirmar cierre/i }).click();
      await expect(dialog).toBeHidden();
    }
  }
}

/** Assert the detail status control reflects the expected label. */
export async function expectDetailStatus(page: Page, label: string) {
  await expect(page.getByLabel(/estado del ticket/i)).toContainText(
    new RegExp(label, "i"),
  );
}
