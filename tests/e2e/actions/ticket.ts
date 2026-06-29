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
  // WebKit may not trigger react-hook-form onChange via fill(); blur to force validation.
  await page.getByLabel(/describe tu problema/i).blur();
  const submitBtn = page.getByRole("button", { name: /enviar ticket/i });
  // WebKit may lag react-hook-form onChange validation; wait for enabled state.
  await expect(submitBtn).toBeEnabled({ timeout: 15_000 });
  await submitBtn.click();

  await expect(
    page.getByRole("heading", { name: /ticket recibido/i }),
  ).toBeVisible({ timeout: 10_000 });
}

/** Dashboard queue: resolve a ticket via the hover-card "Resuelto" quick action. */
export async function resolveViaTooltip(page: Page, subject: string) {
  const button = page.getByRole("button", { name: /^resuelto$/i });
  // Realtime refetches can re-render the row and close the hover-card between
  // hover and click; retry opening the card until the action is visible.
  await expect(async () => {
    await page.getByRole("link", { name: subject }).hover();
    await expect(button).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });

  await button.click();
  // onResolved refetches and the resolved ticket leaves the open queue, so the
  // quick-action button detaches once the resolution has committed. This is a
  // reliable sync point (a generic next-action POST would also match the
  // markTicketAsSeen request fired on hover).
  await expect(button).toBeHidden({ timeout: 10_000 });
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
