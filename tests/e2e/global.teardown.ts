import { test as teardown } from "@playwright/test";
import { cleanupE2ETickets, hasSupabaseEnv } from "./fixtures/db";

/**
 * Runs once after the suite (wired as the `setup` project's teardown). Removes
 * every ticket the tests created so the shared local database does not
 * accumulate test data across runs.
 */
teardown("clean up e2e tickets", async () => {
  if (!hasSupabaseEnv) return;
  await cleanupE2ETickets();
});
