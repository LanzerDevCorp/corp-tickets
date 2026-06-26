import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { getClientTickets, markTicketViewed } from "../client-tickets";

const mockCreateClient = vi.mocked(createClient);

const CLIENT_ID = "client-user-1";
const STAFF_ID = "staff-user-1";
const CLIENT_EMAIL = "client@example.com";
const TICKET_ID = "ticket-1";

function chainForResult(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const methods = [
    "select",
    "insert",
    "upsert",
    "update",
    "eq",
    "neq",
    "is",
    "in",
    "order",
    "limit",
    "single",
    "maybeSingle",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  const promise = Promise.resolve(result);
  chain.then = (onfulfilled: (v: unknown) => unknown, onrejected?: (e: unknown) => unknown) =>
    promise.then(onfulfilled, onrejected);
  chain.single = vi.fn().mockImplementation(() => promise);
  chain.maybeSingle = vi.fn().mockImplementation(() => promise);
  return chain;
}

type MockConfig = {
  claims?: Record<string, unknown> | null;
  userEmail?: string | null;
  tickets?: unknown[];
  ticketViews?: unknown[];
  comments?: unknown[];
  attachments?: unknown[];
  upsertError?: { message: string } | null;
};

function makeSupabaseMock(config: MockConfig) {
  const tableData: Record<string, unknown[]> = {
    tickets: config.tickets ?? [],
    ticket_views: config.ticketViews ?? [],
    comments: config.comments ?? [],
    ticket_attachments: config.attachments ?? [],
  };

  const from = vi.fn((table: string) => {
    const rows = tableData[table] ?? [];
    return chainForResult({ data: rows, error: null });
  });

  const upsertChain = chainForResult({
    data: null,
    error: config.upsertError ?? null,
  });

  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: config.claims ? { claims: config.claims } : { claims: null },
      }),
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: config.userEmail ? { email: config.userEmail } : null,
        },
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "ticket_views" && config.upsertError !== undefined) {
        const upsertMock = chainForResult({
          data: null,
          error: config.upsertError,
        });
        upsertMock.upsert = vi.fn().mockReturnValue(upsertMock);
        upsertMock.select = vi.fn().mockReturnValue(upsertMock);
        return upsertMock;
      }
      return from(table);
    }),
  };
}

function clientClaims() {
  return {
    sub: CLIENT_ID,
    app_role: "client",
    email: CLIENT_EMAIL,
  };
}

describe("client-tickets actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getClientTickets", () => {
    it("throws when unauthenticated", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({ claims: null }) as never
      );

      await expect(getClientTickets()).rejects.toThrow("No autorizado");
    });

    it("throws when not a client role", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: { sub: "staff-1", app_role: "it", email: "it@example.com" },
          userEmail: "it@example.com",
        }) as never
      );

      await expect(getClientTickets()).rejects.toThrow("No autorizado");
    });

    it("returns empty list when client has no tickets", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: clientClaims(),
          userEmail: CLIENT_EMAIL,
          tickets: [],
          ticketViews: [],
          comments: [],
          attachments: [],
        }) as never
      );

      await expect(getClientTickets()).resolves.toEqual([]);
    });

    it("returns list shape with subject, status, created_at, hasNewActivity", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: clientClaims(),
          userEmail: CLIENT_EMAIL,
          tickets: [
            {
              id: TICKET_ID,
              subject: "Mi solicitud",
              status: "open",
              created_at: "2026-06-01T10:00:00Z",
              updated_at: "2026-06-01T10:00:00Z",
              resolved_at: null,
            },
          ],
          ticketViews: [],
          comments: [],
          attachments: [],
        }) as never
      );

      const result = await getClientTickets();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: TICKET_ID,
        subject: "Mi solicitud",
        status: "open",
        created_at: "2026-06-01T10:00:00Z",
        hasNewActivity: false,
      });
    });

    it("shows badge for staff comment after last_viewed_at", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: clientClaims(),
          userEmail: CLIENT_EMAIL,
          tickets: [
            {
              id: TICKET_ID,
              subject: "Test",
              status: "in_progress",
              created_at: "2026-06-01T10:00:00Z",
              updated_at: "2026-06-01T10:00:00Z",
              resolved_at: null,
            },
          ],
          ticketViews: [
            {
              ticket_id: TICKET_ID,
              last_viewed_at: "2026-06-02T10:00:00Z",
            },
          ],
          comments: [
            {
              ticket_id: TICKET_ID,
              author_id: STAFF_ID,
              is_internal: false,
              created_at: "2026-06-03T12:00:00Z",
            },
          ],
          attachments: [],
        }) as never
      );

      const result = await getClientTickets();
      expect(result[0]?.hasNewActivity).toBe(true);
    });

    it("does not show badge for client's own comment after last_viewed_at", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: clientClaims(),
          userEmail: CLIENT_EMAIL,
          tickets: [
            {
              id: TICKET_ID,
              subject: "Test",
              status: "open",
              created_at: "2026-06-01T10:00:00Z",
              updated_at: "2026-06-01T10:00:00Z",
              resolved_at: null,
            },
          ],
          ticketViews: [
            {
              ticket_id: TICKET_ID,
              last_viewed_at: "2026-06-02T10:00:00Z",
            },
          ],
          comments: [
            {
              ticket_id: TICKET_ID,
              author_id: CLIENT_ID,
              is_internal: false,
              created_at: "2026-06-03T12:00:00Z",
            },
          ],
          attachments: [],
        }) as never
      );

      const result = await getClientTickets();
      expect(result[0]?.hasNewActivity).toBe(false);
    });

    it("shows badge for attachment after last_viewed_at", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: clientClaims(),
          userEmail: CLIENT_EMAIL,
          tickets: [
            {
              id: TICKET_ID,
              subject: "Test",
              status: "open",
              created_at: "2026-06-01T10:00:00Z",
              updated_at: "2026-06-01T10:00:00Z",
              resolved_at: null,
            },
          ],
          ticketViews: [
            {
              ticket_id: TICKET_ID,
              last_viewed_at: "2026-06-02T10:00:00Z",
            },
          ],
          comments: [],
          attachments: [
            {
              ticket_id: TICKET_ID,
              created_at: "2026-06-03T14:00:00Z",
              deleted_at: null,
            },
          ],
        }) as never
      );

      const result = await getClientTickets();
      expect(result[0]?.hasNewActivity).toBe(true);
    });

    it("shows badge for status change (updated_at) after last_viewed_at", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: clientClaims(),
          userEmail: CLIENT_EMAIL,
          tickets: [
            {
              id: TICKET_ID,
              subject: "Test",
              status: "in_progress",
              created_at: "2026-06-01T10:00:00Z",
              updated_at: "2026-06-03T15:00:00Z",
              resolved_at: null,
            },
          ],
          ticketViews: [
            {
              ticket_id: TICKET_ID,
              last_viewed_at: "2026-06-02T10:00:00Z",
            },
          ],
          comments: [],
          attachments: [],
        }) as never
      );

      const result = await getClientTickets();
      expect(result[0]?.hasNewActivity).toBe(true);
    });

    it("shows badge for resolved_at after last_viewed_at", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: clientClaims(),
          userEmail: CLIENT_EMAIL,
          tickets: [
            {
              id: TICKET_ID,
              subject: "Test",
              status: "resolved",
              created_at: "2026-06-01T10:00:00Z",
              updated_at: "2026-06-03T16:00:00Z",
              resolved_at: "2026-06-03T16:00:00Z",
            },
          ],
          ticketViews: [
            {
              ticket_id: TICKET_ID,
              last_viewed_at: "2026-06-02T10:00:00Z",
            },
          ],
          comments: [],
          attachments: [],
        }) as never
      );

      const result = await getClientTickets();
      expect(result[0]?.hasNewActivity).toBe(true);
    });

    it("shows badge when never viewed and staff activity exists", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: clientClaims(),
          userEmail: CLIENT_EMAIL,
          tickets: [
            {
              id: TICKET_ID,
              subject: "Test",
              status: "open",
              created_at: "2026-06-01T10:00:00Z",
              updated_at: "2026-06-01T10:00:00Z",
              resolved_at: null,
            },
          ],
          ticketViews: [],
          comments: [
            {
              ticket_id: TICKET_ID,
              author_id: STAFF_ID,
              is_internal: false,
              created_at: "2026-06-02T08:00:00Z",
            },
          ],
          attachments: [],
        }) as never
      );

      const result = await getClientTickets();
      expect(result[0]?.hasNewActivity).toBe(true);
    });
  });

  describe("markTicketViewed", () => {
    it("throws when unauthenticated", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({ claims: null }) as never
      );

      await expect(markTicketViewed(TICKET_ID)).rejects.toThrow("No autorizado");
    });

    it("upserts ticket_views for authenticated client", async () => {
      const mock = makeSupabaseMock({
        claims: clientClaims(),
        userEmail: CLIENT_EMAIL,
        upsertError: null,
      });
      mockCreateClient.mockResolvedValue(mock as never);

      await expect(markTicketViewed(TICKET_ID)).resolves.toBeUndefined();

      expect(mock.from).toHaveBeenCalledWith("ticket_views");
    });

    it("is idempotent on re-open", async () => {
      const mock = makeSupabaseMock({
        claims: clientClaims(),
        userEmail: CLIENT_EMAIL,
        upsertError: null,
      });
      mockCreateClient.mockResolvedValue(mock as never);

      await markTicketViewed(TICKET_ID);
      await expect(markTicketViewed(TICKET_ID)).resolves.toBeUndefined();
    });

    it("surfaces DB errors", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: clientClaims(),
          userEmail: CLIENT_EMAIL,
          upsertError: { message: "upsert failed" },
        }) as never
      );

      await expect(markTicketViewed(TICKET_ID)).rejects.toThrow("upsert failed");
    });
  });
});
