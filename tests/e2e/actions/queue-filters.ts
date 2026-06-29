import { expect, type Page } from "@playwright/test";

/**
 * Reusable actions for the dashboard ticket-queue filters. Kept separate from
 * `ticket.ts` so the queue-filter concern composes independently of the ticket
 * lifecycle affordances.
 */

/** Stable accessible names of the four queue-filter comboboxes (aria-label). */
export const QUEUE_FILTER = {
  status: "Filtrar por estado",
  priority: "Filtrar por prioridad",
  assignee: "Filtrar por asignado",
  category: "Filtrar por categoría",
} as const;

/**
 * Open a queue-filter combobox and choose an option by its visible label.
 *
 * The status/category filters are MultiSelects (`multiselect: true`): they mount
 * a hidden duplicate of every item for the trigger badges, so the option is
 * scoped to the visible popover to avoid a strict-mode match, and the popover —
 * which stays open after a toggle — is closed with Escape afterwards. The
 * priority/assignee filters are plain Selects that close on choice.
 */
export async function selectQueueFilter(
  page: Page,
  filterName: string,
  optionName: string,
  opts: { multiselect?: boolean } = {},
) {
  await page.getByRole("combobox", { name: filterName }).click();

  const option = opts.multiselect
    ? page.locator("[role=option]:visible", { hasText: optionName })
    : page.getByRole("option", { name: optionName });

  await option.click();

  if (opts.multiselect) {
    await page.keyboard.press("Escape");
  }
}

/** Assert a queue-filter combobox currently displays the expected value. */
export async function expectQueueFilter(
  page: Page,
  filterName: string,
  value: string,
) {
  await expect(page.getByRole("combobox", { name: filterName })).toContainText(
    value,
  );
}
