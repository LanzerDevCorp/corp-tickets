/**
 * DB Integration tests — resolved_at trigger (migration 20260625140000).
 *
 * PREREQUISITES (tests are SKIPPED unless ALL of these are met):
 *   - `npx supabase start` must be running locally.
 *   - Environment variables must be set:
 *       SUPABASE_TEST_URL              (default: http://127.0.0.1:54321)
 *       SUPABASE_TEST_ANON_KEY         (required)
 *       SUPABASE_TEST_SERVICE_ROLE_KEY (required)
 *
 * Run:
 *   npx supabase start
 *   SUPABASE_TEST_ANON_KEY=<anon>  \
 *   SUPABASE_TEST_SERVICE_ROLE_KEY=<service> \
 *   npm test __tests__/db/resolved-at.integration.test.ts
 *
 * Design:
 *   The test uses an authenticated staff user (admin role) to INSERT/UPDATE
 *   tickets, because the project's RLS policies grant staff full access via
 *   `authenticated` role — service_role lacks explicit table-level DML grants
 *   in this project's schema (same constraint as rls.test.ts).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54321";
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? "";

const runIntegration = Boolean(ANON_KEY && SERVICE_KEY);

const TEST_ADMIN_EMAIL = "resolved-at-admin@test.local";
const TEST_ADMIN_PASSWORD = "TestPass1!";

describe.skipIf(!runIntegration)(
  "resolved_at trigger — set_resolved_at_on_status_change",
  () => {
    /** Service-role client — used only for auth admin operations and teardown. */
    let serviceAdmin: SupabaseClient;
    /** Signed-in staff client — used for ticket CRUD (RLS allows staff full access). */
    let staffClient: SupabaseClient;
    let ticketId: string;
    let categoryId: string;

    beforeAll(async () => {
      serviceAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Create (or reuse) test admin user
      await serviceAdmin.auth.admin.createUser({
        email: TEST_ADMIN_EMAIL,
        password: TEST_ADMIN_PASSWORD,
        email_confirm: true,
        app_metadata: { role: "admin" },
      });

      // Sign in as the admin staff user
      staffClient = createClient(SUPABASE_URL, ANON_KEY);
      const { error: signInErr } = await staffClient.auth.signInWithPassword({
        email: TEST_ADMIN_EMAIL,
        password: TEST_ADMIN_PASSWORD,
      });
      if (signInErr) throw new Error(`Staff sign-in failed: ${signInErr.message}`);

      // Seed a category (required FK)
      const { data: cat, error: catErr } = await staffClient
        .from("categories")
        .insert({ name: "resolved-at-test-category-" + Date.now() })
        .select()
        .single();
      if (catErr) throw new Error(`Seed category failed: ${catErr.message}`);
      categoryId = cat.id;

      // Insert a fresh open ticket for trigger tests
      const { data: ticket, error: ticketErr } = await staffClient
        .from("tickets")
        .insert({
          email: "resolved-at-trigger-test@test.local",
          subject: "resolved_at trigger integration test",
          name: "Trigger Test User",
          body: "Testing set_resolved_at_on_status_change trigger",
          status: "open",
          category_id: categoryId,
        })
        .select()
        .single();
      if (ticketErr) throw new Error(`Seed ticket failed: ${ticketErr.message}`);
      ticketId = ticket.id;
    });

    afterAll(async () => {
      // Clean up in dependency order: ticket → category → user
      if (ticketId) await staffClient.from("tickets").delete().eq("id", ticketId);
      if (categoryId) await staffClient.from("categories").delete().eq("id", categoryId);
      if (TEST_ADMIN_EMAIL) {
        const { data: users } = await serviceAdmin.auth.admin.listUsers();
        const testUser = users?.users?.find((u) => u.email === TEST_ADMIN_EMAIL);
        if (testUser) await serviceAdmin.auth.admin.deleteUser(testUser.id);
      }
    });

    it("(a) open → resolved sets resolved_at to a non-NULL timestamp", async () => {
      const { data, error } = await staffClient
        .from("tickets")
        .update({ status: "resolved" })
        .eq("id", ticketId)
        .select("resolved_at")
        .single();

      expect(error).toBeNull();
      expect(data!.resolved_at).not.toBeNull();
      expect(Number.isNaN(new Date(data!.resolved_at).getTime())).toBe(false);
    });

    it("(b) update within resolved leaves resolved_at unchanged", async () => {
      const { data: before, error: readErr } = await staffClient
        .from("tickets")
        .select("resolved_at")
        .eq("id", ticketId)
        .single();

      expect(readErr).toBeNull();
      const resolvedAtBefore = before!.resolved_at;

      const { data, error } = await staffClient
        .from("tickets")
        .update({ subject: "Updated subject (still resolved)" })
        .eq("id", ticketId)
        .select("resolved_at")
        .single();

      expect(error).toBeNull();
      expect(data!.resolved_at).toBe(resolvedAtBefore);
    });

    it("(c) resolved → open clears resolved_at to NULL", async () => {
      const { data, error } = await staffClient
        .from("tickets")
        .update({ status: "open" })
        .eq("id", ticketId)
        .select("resolved_at")
        .single();

      expect(error).toBeNull();
      expect(data!.resolved_at).toBeNull();
    });

    it("(d) closed → resolved again sets a new non-NULL resolved_at", async () => {
      // Transition: open → closed (requires closure_reason per schema constraint)
      await staffClient
        .from("tickets")
        .update({ status: "closed", closure_reason: "Test closure for trigger test" })
        .eq("id", ticketId);

      const { data, error } = await staffClient
        .from("tickets")
        .update({ status: "resolved", closure_reason: null })
        .eq("id", ticketId)
        .select("resolved_at")
        .single();

      expect(error).toBeNull();
      expect(data!.resolved_at).not.toBeNull();
      expect(Number.isNaN(new Date(data!.resolved_at).getTime())).toBe(false);
    });
  }
);
