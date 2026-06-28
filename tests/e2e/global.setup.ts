import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { expect, test as setup } from "@playwright/test";
import {
  E2E_ADMIN_EMAIL,
  E2E_ADMIN_PASSWORD,
  STORAGE_STATE,
} from "./fixtures/auth";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Authentication setup — runs once before the authenticated suite.
 *
 * 1. Guarantees a dedicated E2E admin (created/reset idempotently via the
 *    service role) with a known password and the `admin` RBAC role.
 * 2. Logs in through the real login form so the session cookie is set exactly
 *    as the app expects.
 * 3. Persists the session to STORAGE_STATE so authenticated specs start already
 *    logged in — no repeated login per test, no tokens spent re-authenticating.
 */
setup("authenticate as e2e admin", async ({ page }) => {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. " +
        "Start local Supabase and ensure the values are loaded from .env.",
    );
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // The admin RBAC role travels in the JWT as the `app_role` claim, sourced
  // from app_metadata.role via the custom access token hook.
  const appMetadata = { role: "admin" };

  const { data: list, error: listError } = await admin.auth.admin.listUsers();
  if (listError) throw listError;

  const existing = list.users.find((user) => user.email === E2E_ADMIN_EMAIL);

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: E2E_ADMIN_PASSWORD,
      email_confirm: true,
      app_metadata: appMetadata,
    });
    if (error) throw error;
  } else {
    const { error } = await admin.auth.admin.createUser({
      email: E2E_ADMIN_EMAIL,
      password: E2E_ADMIN_PASSWORD,
      email_confirm: true,
      app_metadata: appMetadata,
    });
    if (error) throw error;
  }

  await page.goto("/auth/login");
  await page.fill('[name="email"]', E2E_ADMIN_EMAIL);
  await page.fill('[name="password"]', E2E_ADMIN_PASSWORD);
  await page.click('[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/);

  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });
  await page.context().storageState({ path: STORAGE_STATE });
});
