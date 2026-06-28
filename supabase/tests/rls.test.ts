/**
 * RLS integration tests — require Supabase CLI running locally.
 * Run via: npx supabase start && npm test supabase/tests/rls.test.ts
 *
 * BLOCKER T001: These tests are skipped unless SUPABASE_TEST_ANON_KEY
 * and SUPABASE_TEST_SERVICE_ROLE_KEY env vars are set.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54321";
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? "";

const runIntegration = Boolean(ANON_KEY && SERVICE_KEY);

describe.skipIf(!runIntegration)("RLS Policies — 001_auth_phase", () => {
  let admin: SupabaseClient;
  let adminUserId: string;
  let clientAUserId: string;
  let clientBUserId: string;

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: adminUser } = await admin.auth.admin.createUser({
      email: "admin@test.local",
      password: "TestPass1!",
      email_confirm: true,
      app_metadata: { role: "admin" },
    });
    adminUserId = adminUser.user!.id;

    await admin.auth.admin.createUser({
      email: "it@test.local",
      password: "TestPass1!",
      email_confirm: true,
      app_metadata: { role: "it" },
    });

    const { data: clientA } = await admin.auth.admin.createUser({
      email: "clienta@test.local",
      password: "TestPass1!",
      email_confirm: true,
      app_metadata: { role: "client" },
    });
    clientAUserId = clientA.user!.id;

    const { data: clientB } = await admin.auth.admin.createUser({
      email: "clientb@test.local",
      password: "TestPass1!",
      email_confirm: true,
      app_metadata: { role: "client" },
    });
    clientBUserId = clientB.user!.id;
  });

  async function clientAs(email: string, password: string) {
    const client = createClient(SUPABASE_URL, ANON_KEY);
    await client.auth.signInWithPassword({ email, password });
    return client;
  }

  it("Admin can SELECT all users", async () => {
    const adminClient = await clientAs("admin@test.local", "TestPass1!");
    const { data, error } = await adminClient.from("users").select("*");
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(4);
  });

  it("IT can SELECT all users but not DELETE", async () => {
    const itClient = await clientAs("it@test.local", "TestPass1!");
    const { data, error: selectErr } = await itClient.from("users").select("*");
    expect(selectErr).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(1);

    const { error: deleteErr } = await itClient
      .from("users")
      .delete()
      .eq("id", adminUserId);
    expect(deleteErr).not.toBeNull();
  });

  it("Client sees only own row from public.users", async () => {
    const clientA = await clientAs("clienta@test.local", "TestPass1!");
    const { data, error } = await clientA.from("users").select("*");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].id).toBe(clientAUserId);
  });

  it("Client A cannot see Client B tickets", async () => {
    await admin.from("tickets").insert({
      email: "clientb@test.local",
      subject: "Client B ticket",
    });

    const clientA = await clientAs("clienta@test.local", "TestPass1!");
    const { data } = await clientA.from("tickets").select("*");
    const clientBTickets = data?.filter(
      (t) => t.email === "clientb@test.local",
    );
    expect(clientBTickets).toHaveLength(0);
  });

  it("Client cannot see internal comments on own ticket", async () => {
    const { data: ticket } = await admin
      .from("tickets")
      .insert({ email: "clienta@test.local", subject: "Client A ticket" })
      .select()
      .single();

    await admin.from("comments").insert({
      ticket_id: ticket.id,
      author_id: adminUserId,
      body: "Internal note",
      is_internal: true,
    });

    const clientA = await clientAs("clienta@test.local", "TestPass1!");
    const { data: comments } = await clientA
      .from("comments")
      .select("*")
      .eq("ticket_id", ticket.id);

    const internal = comments?.filter((c) => c.is_internal === true);
    expect(internal).toHaveLength(0);
  });

  it("Client sees only is_enabled=true categories", async () => {
    await admin.from("categories").insert([
      { name: "Enabled Cat", is_enabled: true },
      { name: "Disabled Cat", is_enabled: false },
    ]);

    const clientA = await clientAs("clienta@test.local", "TestPass1!");
    const { data } = await clientA.from("categories").select("*");
    const disabled = data?.filter((c) => c.is_enabled === false);
    expect(disabled).toHaveLength(0);
  });
});

describe.skipIf(!runIntegration)("RLS Policies — comments", () => {
  let admin: SupabaseClient;
  let adminUserId: string;
  let clientAUserId: string;
  let ticketId: string;
  let ownedTicketId: string;
  let otherTicketId: string;

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Reuse or create test users
    const { data: adminUser } = await admin.auth.admin.createUser({
      email: "comments-admin@test.local",
      password: "TestPass1!",
      email_confirm: true,
      app_metadata: { role: "admin" },
    });
    adminUserId = adminUser.user!.id;

    const { data: clientA } = await admin.auth.admin.createUser({
      email: "comments-clienta@test.local",
      password: "TestPass1!",
      email_confirm: true,
      app_metadata: { role: "client" },
    });
    clientAUserId = clientA.user!.id;

    await admin.auth.admin.createUser({
      email: "comments-clientb@test.local",
      password: "TestPass1!",
      email_confirm: true,
      app_metadata: { role: "client" },
    });

    // Seed a category (required FK for tickets)
    const { data: cat } = await admin
      .from("categories")
      .insert({ name: "Comments Test Cat" })
      .select()
      .single();

    // Ticket owned by clientA
    const { data: ticketA } = await admin
      .from("tickets")
      .insert({
        email: "comments-clienta@test.local",
        subject: "ClientA ticket",
        name: "ClientA",
        body: "test body for comments",
        category_id: cat.id,
      })
      .select()
      .single();
    ownedTicketId = ticketA.id;
    ticketId = ownedTicketId;

    // Ticket owned by clientB (not clientA)
    const { data: ticketB } = await admin
      .from("tickets")
      .insert({
        email: "comments-clientb@test.local",
        subject: "ClientB ticket",
        name: "ClientB",
        body: "test body for comments",
        category_id: cat.id,
      })
      .select()
      .single();
    otherTicketId = ticketB.id;
  });

  async function clientAs(email: string, password: string) {
    const client = createClient(SUPABASE_URL, ANON_KEY);
    await client.auth.signInWithPassword({ email, password });
    return client;
  }

  it("Staff can INSERT a public comment", async () => {
    const staffClient = await clientAs(
      "comments-admin@test.local",
      "TestPass1!",
    );
    const { error } = await staffClient.from("comments").insert({
      ticket_id: ticketId,
      author_id: adminUserId,
      body: "Staff public comment",
      is_internal: false,
    });
    expect(error).toBeNull();
  });

  it("Staff can INSERT an internal comment", async () => {
    const staffClient = await clientAs(
      "comments-admin@test.local",
      "TestPass1!",
    );
    const { error } = await staffClient.from("comments").insert({
      ticket_id: ticketId,
      author_id: adminUserId,
      body: "Staff internal note",
      is_internal: true,
    });
    expect(error).toBeNull();
  });

  it("Staff can SELECT all comments (public and internal)", async () => {
    const staffClient = await clientAs(
      "comments-admin@test.local",
      "TestPass1!",
    );
    const { data, error } = await staffClient
      .from("comments")
      .select("*")
      .eq("ticket_id", ticketId);
    expect(error).toBeNull();
    const internal = data?.filter((c) => c.is_internal === true);
    const pub = data?.filter((c) => c.is_internal === false);
    expect(internal!.length).toBeGreaterThanOrEqual(1);
    expect(pub!.length).toBeGreaterThanOrEqual(1);
  });

  it("Client can SELECT public comments on their own ticket", async () => {
    const clientA = await clientAs("comments-clienta@test.local", "TestPass1!");
    const { data, error } = await clientA
      .from("comments")
      .select("*")
      .eq("ticket_id", ownedTicketId);
    expect(error).toBeNull();
    const pub = data?.filter((c) => c.is_internal === false);
    expect(pub!.length).toBeGreaterThanOrEqual(1);
  });

  it("Client CANNOT SELECT internal comments on their own ticket", async () => {
    const clientA = await clientAs("comments-clienta@test.local", "TestPass1!");
    const { data } = await clientA
      .from("comments")
      .select("*")
      .eq("ticket_id", ownedTicketId);
    const internal = data?.filter((c) => c.is_internal === true);
    expect(internal).toHaveLength(0);
  });

  it("Client CANNOT SELECT comments on a ticket they don't own", async () => {
    const clientA = await clientAs("comments-clienta@test.local", "TestPass1!");
    const { data } = await clientA
      .from("comments")
      .select("*")
      .eq("ticket_id", otherTicketId);
    expect(data).toHaveLength(0);
  });

  it("Anon CANNOT SELECT any comments", async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY);
    const { data } = await anon
      .from("comments")
      .select("*")
      .eq("ticket_id", ticketId);
    expect(data).toHaveLength(0);
  });

  it("Client INSERT with is_internal=true is blocked by RLS", async () => {
    const clientA = await clientAs("comments-clienta@test.local", "TestPass1!");
    const { error } = await clientA.from("comments").insert({
      ticket_id: ownedTicketId,
      author_id: clientAUserId,
      body: "Client trying to sneak an internal comment",
      is_internal: true,
    });
    expect(error).not.toBeNull();
  });

  it("INSERT without author_id fails NOT NULL constraint", async () => {
    const staffClient = await clientAs(
      "comments-admin@test.local",
      "TestPass1!",
    );
    const { error } = await staffClient.from("comments").insert({
      ticket_id: ticketId,
      body: "Missing author_id",
      is_internal: false,
    } as any);
    expect(error).not.toBeNull();
  });

  it("Nobody can UPDATE a comment (no UPDATE policy)", async () => {
    // Seed a comment to attempt updating
    const { data: comment } = await admin
      .from("comments")
      .insert({
        ticket_id: ticketId,
        author_id: adminUserId,
        body: "Original body",
        is_internal: false,
      })
      .select()
      .single();

    const staffClient = await clientAs(
      "comments-admin@test.local",
      "TestPass1!",
    );
    const { data: updated, error } = await staffClient
      .from("comments")
      .update({ body: "Attempted edit" })
      .eq("id", comment!.id)
      .select();

    // RLS with no UPDATE policy returns empty result (0 rows affected) or an error
    const rowsAffected = updated?.length ?? 0;
    expect(rowsAffected).toBe(0);
  });

  it("Nobody can DELETE a comment (no DELETE policy)", async () => {
    // Seed a comment to attempt deleting
    const { data: comment } = await admin
      .from("comments")
      .insert({
        ticket_id: ticketId,
        author_id: adminUserId,
        body: "Comment to try deleting",
        is_internal: false,
      })
      .select()
      .single();

    const staffClient = await clientAs(
      "comments-admin@test.local",
      "TestPass1!",
    );
    const { data: deleted, error } = await staffClient
      .from("comments")
      .delete()
      .eq("id", comment!.id)
      .select();

    // RLS with no DELETE policy returns empty result or error
    const rowsAffected = deleted?.length ?? 0;
    expect(rowsAffected).toBe(0);
  });
});
