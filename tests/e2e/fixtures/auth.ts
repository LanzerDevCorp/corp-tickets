import path from "node:path";

/**
 * Shared authentication constants for E2E tests.
 *
 * Kept in a plain (non-test) module so both `global.setup.ts` and specs can
 * import them without re-registering the setup test.
 */

/** Persisted Playwright storage state (cookies + origin storage) for the admin session. */
export const STORAGE_STATE = path.join(
  process.cwd(),
  "tests/e2e/.auth/admin.json",
);

/** Dedicated E2E admin — created/reset idempotently by global.setup.ts. */
export const E2E_ADMIN_EMAIL =
  process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@test.com";
export const E2E_ADMIN_PASSWORD =
  process.env.E2E_ADMIN_PASSWORD ?? "E2eAdminPass1!";
