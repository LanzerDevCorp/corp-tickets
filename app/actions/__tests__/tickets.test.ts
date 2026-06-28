import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAdminQueryChain = vi.hoisted(() => ({
  insert: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  single: vi.fn(),
}));

vi.mock("@/app/actions/client-provision", () => ({
  provisionClient: vi.fn().mockResolvedValue({
    userId: "user-123",
    alreadyExisted: false,
    actionLink: "https://auth.test/magic",
    error: null,
  }),
}));

vi.mock("@/lib/notifications/tickets", () => ({
  notifyNewTicket: vi.fn().mockResolvedValue(undefined),
  notifyTicketCreated: vi.fn().mockResolvedValue(undefined),
  notifyTicketClosed: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/turnstile/verify", () => ({
  verifyTurnstileToken: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn(() => mockAdminQueryChain),
    auth: { admin: {} },
  },
}));

import {
  submitTicket,
  getTickets,
  getTicketDetail,
  updateTicketStatus,
  assignTicket,
  getCategories,
  getStaffUsers,
  markTicketAsSeen,
} from "../tickets";
import { provisionClient } from "@/app/actions/client-provision";
import { createClient } from "@/lib/supabase/server";
import { verifyTurnstileToken } from "@/lib/turnstile/verify";
import {
  notifyNewTicket,
  notifyTicketCreated,
  notifyTicketClosed,
} from "@/lib/notifications/tickets";

const mockProvisionClient = vi.mocked(provisionClient);
const mockCreateClient = vi.mocked(createClient);
const mockVerifyTurnstile = vi.mocked(verifyTurnstileToken);

function makeSupabaseMock(options: {
  claims?: any;
  queryResult?: any;
  updateResult?: any;
  userEmail?: string;
}) {
  const queryChain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(options.queryResult || { data: null, error: null }),
      ),
    maybeSingle: vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(options.updateResult || { data: null, error: null }),
      ),
  };

  // Setup thenable behavior for standard queries (e.g. await query)
  const mockPromise = Promise.resolve(
    options.queryResult || { data: null, error: null },
  );
  queryChain.then = (onfulfilled: any, onrejected: any) =>
    mockPromise.then(onfulfilled, onrejected);

  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: options.claims ? { claims: options.claims } : { claims: null },
      }),
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: options.userEmail ? { email: options.userEmail } : null,
        },
      }),
    },
    from: vi.fn().mockReturnValue(queryChain),
  };
}

describe("tickets actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminQueryChain.insert.mockReturnThis();
    mockAdminQueryChain.select.mockReturnThis();
    mockAdminQueryChain.single.mockResolvedValue({
      data: { id: "ticket-abc" },
      error: null,
    });
  });

  describe("submitTicket", () => {
    const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

    function validFormData() {
      const fd = new FormData();
      fd.set("name", "Juan Perez");
      fd.set("email", "client@test.com");
      fd.set("subject", "No puedo acceder");
      fd.set("body", "Desde esta mañana no puedo entrar al sistema.");
      fd.set("priority", "medium");
      fd.set("category_id", VALID_UUID);
      fd.set("turnstile_token", "cf-test-token");
      return fd;
    }

    it("inserta ticket y llama provisionClient con email y ticketId", async () => {
      const result = await submitTicket(null as any, validFormData());

      expect(result.error).toBeNull();
      if (result.error === null) {
        expect(result.ticketId).toBe("ticket-abc");
      }
      expect(mockProvisionClient).toHaveBeenCalledWith(
        "client@test.com",
        "ticket-abc",
      );
    });

    it("retorna error de validación cuando faltan campos requeridos", async () => {
      const fd = new FormData();
      fd.set("name", "A"); // muy corto
      fd.set("email", "not-an-email");
      fd.set("subject", "ok");
      fd.set("body", "corto");
      fd.set("category_id", "not-uuid");
      fd.set("turnstile_token", "token");

      const result = await submitTicket(null as any, fd);

      expect(result.error).toBeTruthy();
      if (result.error) {
        expect((result as any).code).toBe("validation");
      }
      expect(mockProvisionClient).not.toHaveBeenCalled();
    });

    it("retorna error con code 'turnstile' cuando la verificación falla", async () => {
      mockVerifyTurnstile.mockResolvedValueOnce({
        success: false,
        error: "La verificación de seguridad falló. Intenta de nuevo.",
      });

      const result = await submitTicket(null as any, validFormData());

      expect(result.error).toBeTruthy();
      if (result.error) {
        expect((result as any).code).toBe("turnstile");
      }
      expect(mockProvisionClient).not.toHaveBeenCalled();
    });

    it("retorna error genérico cuando el insert de DB falla", async () => {
      mockAdminQueryChain.single.mockResolvedValueOnce({
        data: null,
        error: { message: "DB error" },
      });

      const result = await submitTicket(null as any, validFormData());

      expect(result.error).toBeTruthy();
      if (result.error) {
        expect((result as any).code).toBe("db");
      }
      expect(mockProvisionClient).not.toHaveBeenCalled();
    });

    it("calls notifyTicketCreated with ticketId and actionLink after successful insert", async () => {
      mockAdminQueryChain.single.mockResolvedValueOnce({
        data: { id: "ticket-created-email" },
        error: null,
      });

      await submitTicket(null as any, validFormData());

      expect(notifyTicketCreated).toHaveBeenCalledWith(
        "ticket-created-email",
        "https://auth.test/magic",
      );
    });

    it("does not call notifyTicketCreated when provisionClient returns no actionLink", async () => {
      mockAdminQueryChain.single.mockResolvedValueOnce({
        data: { id: "ticket-no-link" },
        error: null,
      });
      mockProvisionClient.mockResolvedValueOnce({
        userId: "user-123",
        alreadyExisted: false,
        actionLink: null,
        error: "link failed",
      } as any);

      await submitTicket(null as any, validFormData());

      expect(notifyTicketCreated).not.toHaveBeenCalled();
    });

    it("calls notifyNewTicket with correct ticketId after successful ticket insert", async () => {
      mockAdminQueryChain.single.mockResolvedValueOnce({
        data: { id: "ticket-notify-test" },
        error: null,
      });

      await submitTicket(null as any, validFormData());

      expect(notifyNewTicket).toHaveBeenCalledWith("ticket-notify-test");
    });

    it("does not call notifyNewTicket when ticket insert fails", async () => {
      mockAdminQueryChain.single.mockResolvedValueOnce({
        data: null,
        error: { message: "DB error" },
      });

      await submitTicket(null as any, validFormData());

      expect(notifyNewTicket).not.toHaveBeenCalled();
    });

    it("sigue retornando ticketId aunque provisionClient falle", async () => {
      mockAdminQueryChain.single.mockResolvedValueOnce({
        data: { id: "ticket-xyz" },
        error: null,
      });
      mockProvisionClient.mockResolvedValueOnce({
        userId: null,
        alreadyExisted: false,
        actionLink: null,
        error: "provision failed",
      } as any);

      const result = await submitTicket(null as any, validFormData());

      expect(result.error).toBeNull();
      if (result.error === null) {
        expect(result.ticketId).toBe("ticket-xyz");
      }
    });
  });

  describe("getTickets", () => {
    it("allows staff (admin/it) to fetch tickets", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: { app_role: "it" },
          queryResult: { data: [{ id: "ticket-1" }], error: null },
        }) as any,
      );

      const tickets = await getTickets({});
      expect(tickets).toHaveLength(1);
      expect(tickets[0].id).toBe("ticket-1");
    });

    it("throws error if client attempts to fetch all tickets", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: { app_role: "client" },
        }) as any,
      );

      await expect(getTickets({})).rejects.toThrow("No autorizado");
    });

    it("applies .in() filter when statuses are provided", async () => {
      const mock = makeSupabaseMock({
        claims: { app_role: "it" },
        queryResult: { data: [{ id: "ticket-1" }], error: null },
      });
      mockCreateClient.mockResolvedValue(mock as any);

      await getTickets({ statuses: ["open", "in_progress"] });

      const chain = (mock.from as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      expect(chain.in).toHaveBeenCalledWith("status", ["open", "in_progress"]);
    });

    it("does not apply status filter when statuses is undefined", async () => {
      const mock = makeSupabaseMock({
        claims: { app_role: "it" },
        queryResult: { data: [{ id: "ticket-1" }], error: null },
      });
      mockCreateClient.mockResolvedValue(mock as any);

      await getTickets({});

      const chain = (mock.from as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      expect(chain.in).not.toHaveBeenCalled();
    });

    it("does not apply status filter when statuses contains only 'all'", async () => {
      const mock = makeSupabaseMock({
        claims: { app_role: "it" },
        queryResult: { data: [{ id: "ticket-1" }], error: null },
      });
      mockCreateClient.mockResolvedValue(mock as any);

      await getTickets({ statuses: ["all"] });

      const chain = (mock.from as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      expect(chain.in).not.toHaveBeenCalled();
    });
  });

  describe("getTicketDetail", () => {
    it("allows clients to fetch their own ticket if email matches", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: {
            app_role: "client",
            email: "my-email@test.com",
            sub: "client-1",
          },
          queryResult: {
            data: { id: "ticket-1", email: "my-email@test.com" },
            error: null,
          },
        }) as any,
      );

      const ticket = await getTicketDetail("ticket-1");
      expect(ticket.id).toBe("ticket-1");
    });

    it("throws not authorized when client session is missing", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: null,
        }) as any,
      );

      await expect(getTicketDetail("ticket-1")).rejects.toThrow(
        "No autorizado",
      );
    });

    it("throws error for clients if ticket email does not match client email", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: {
            app_role: "client",
            email: "other@test.com",
            sub: "client-1",
          },
          queryResult: { data: null, error: { message: "No rows found" } },
        }) as any,
      );

      await expect(getTicketDetail("ticket-1")).rejects.toThrow(
        "Ticket no encontrado o acceso denegado",
      );
    });

    it("triggers auto-assignment to staff if ticket is open and unassigned", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: { app_role: "it", sub: "staff-uuid" },
          updateResult: {
            data: {
              id: "ticket-1",
              assigned_to: "staff-uuid",
              status: "in_progress",
            },
            error: null,
          },
        }) as any,
      );

      const ticket = await getTicketDetail("ticket-1");
      expect(ticket.assigned_to).toBe("staff-uuid");
      expect(ticket.status).toBe("in_progress");
    });

    it("does not auto-assign and reads normally if ticket is already assigned/in_progress", async () => {
      // updateResult returns null (update failed constraint of eq('status', 'open').is('assigned_to', null))
      // queryResult returns the existing ticket
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: { app_role: "it", sub: "staff-uuid" },
          updateResult: null,
          queryResult: {
            data: {
              id: "ticket-1",
              assigned_to: "other-staff-uuid",
              status: "in_progress",
            },
            error: null,
          },
        }) as any,
      );

      const ticket = await getTicketDetail("ticket-1");
      expect(ticket.assigned_to).toBe("other-staff-uuid");
      expect(ticket.status).toBe("in_progress");
    });
  });

  describe("updateTicketStatus", () => {
    it("allows staff to update status to closed with a closure reason", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: { app_role: "admin" },
          queryResult: {
            data: { id: "ticket-1", status: "closed", closure_reason: "Fixed" },
            error: null,
          },
        }) as any,
      );

      const ticket = await updateTicketStatus("ticket-1", "closed", "Fixed");
      expect(ticket.status).toBe("closed");
      expect(ticket.closure_reason).toBe("Fixed");
      expect(notifyTicketClosed).toHaveBeenCalledWith("ticket-1");
    });

    it("throws error when updating status to closed without a closure reason", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: { app_role: "admin" },
        }) as any,
      );

      await expect(updateTicketStatus("ticket-1", "closed")).rejects.toThrow(
        "Se requiere un motivo de cierre cuando el estado es cerrado",
      );
    });
  });

  describe("assignTicket", () => {
    it("allows staff to change ticket assignment", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: { app_role: "it" },
          queryResult: {
            data: { id: "ticket-1", assigned_to: "new-staff-id" },
            error: null,
          },
        }) as any,
      );

      const ticket = await assignTicket("ticket-1", "new-staff-id");
      expect(ticket.assigned_to).toBe("new-staff-id");
    });
  });

  describe("getCategories", () => {
    it("returns only enabled categories for clients", async () => {
      const mockSupabase = makeSupabaseMock({
        claims: { app_role: "client" },
        queryResult: { data: [{ id: "cat-1", is_enabled: true }], error: null },
      });
      mockCreateClient.mockResolvedValue(mockSupabase as any);

      const categories = await getCategories();
      expect(categories).toHaveLength(1);
      expect(mockSupabase.from().select().eq).toHaveBeenCalledWith(
        "is_enabled",
        true,
      );
    });

    it("returns all categories for staff", async () => {
      const mockSupabase = makeSupabaseMock({
        claims: { app_role: "it" },
        queryResult: { data: [{ id: "cat-1" }, { id: "cat-2" }], error: null },
      });
      mockCreateClient.mockResolvedValue(mockSupabase as any);

      const categories = await getCategories();
      expect(categories).toHaveLength(2);
      expect(mockSupabase.from().select().eq).not.toHaveBeenCalled();
    });
  });

  describe("getStaffUsers", () => {
    it("allows staff to list active staff members", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: { app_role: "it" },
          queryResult: {
            data: [{ id: "staff-1", display_name: "Juan" }],
            error: null,
          },
        }) as any,
      );

      const staff = await getStaffUsers();
      expect(staff).toHaveLength(1);
      expect(staff[0].display_name).toBe("Juan");
    });
  });

  describe("markTicketAsSeen", () => {
    it("admin role marks ticket as seen without error and calls update with correct args", async () => {
      const mock = makeSupabaseMock({
        claims: { app_role: "admin" },
        queryResult: { data: null, error: null },
      });
      mockCreateClient.mockResolvedValue(mock as any);

      await expect(markTicketAsSeen("ticket-1")).resolves.toBeUndefined();

      const chain = (mock.from as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ first_seen_at: expect.any(String) }),
      );
      expect(chain.eq).toHaveBeenCalledWith("id", "ticket-1");
      expect(chain.is).toHaveBeenCalledWith("first_seen_at", null);
    });

    it("it role can also mark ticket as seen", async () => {
      const mock = makeSupabaseMock({
        claims: { app_role: "it" },
        queryResult: { data: null, error: null },
      });
      mockCreateClient.mockResolvedValue(mock as any);

      await expect(markTicketAsSeen("ticket-2")).resolves.toBeUndefined();
    });

    it("non-staff role throws notAuthorized and performs no DB write", async () => {
      const mock = makeSupabaseMock({
        claims: { app_role: "client" },
        queryResult: { data: null, error: null },
      });
      mockCreateClient.mockResolvedValue(mock as any);

      await expect(markTicketAsSeen("ticket-1")).rejects.toThrow(
        "No autorizado",
      );

      // from() should not have been called (no DB write)
      expect(mock.from).not.toHaveBeenCalled();
    });

    it("idempotent: zero rows updated (ticket already seen) does not throw", async () => {
      // PostgREST returns no error when WHERE conditions match 0 rows —
      // simulated here as { data: null, error: null } (success, 0 rows updated).
      const mock = makeSupabaseMock({
        claims: { app_role: "admin" },
        queryResult: { data: null, error: null },
      });
      mockCreateClient.mockResolvedValue(mock as any);

      await expect(
        markTicketAsSeen("ticket-already-seen"),
      ).resolves.toBeUndefined();
    });

    it("surfaces a DB error as a thrown Error with error.message", async () => {
      const mock = makeSupabaseMock({
        claims: { app_role: "it" },
        queryResult: { data: null, error: { message: "connection refused" } },
      });
      mockCreateClient.mockResolvedValue(mock as any);

      await expect(markTicketAsSeen("ticket-1")).rejects.toThrow(
        "connection refused",
      );
    });
  });
});
