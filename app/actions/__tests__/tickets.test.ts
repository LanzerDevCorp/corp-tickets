import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/app/actions/client-provision", () => ({
  provisionClient: vi.fn().mockResolvedValue({
    userId: "user-123",
    alreadyExisted: false,
    error: null,
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import {
  submitTicket,
  getTickets,
  getTicketDetail,
  updateTicketStatus,
  assignTicket,
  getCategories,
  getStaffUsers,
} from "../tickets";
import { provisionClient } from "@/app/actions/client-provision";
import { createClient } from "@/lib/supabase/server";

const mockProvisionClient = vi.mocked(provisionClient);
const mockCreateClient = vi.mocked(createClient);

function makeSupabaseMock(options: {
  claims?: any;
  queryResult?: any;
  updateResult?: any;
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
    single: vi.fn().mockImplementation(() => Promise.resolve(options.queryResult || { data: null, error: null })),
    maybeSingle: vi.fn().mockImplementation(() => Promise.resolve(options.updateResult || { data: null, error: null })),
  };

  // Setup thenable behavior for standard queries (e.g. await query)
  const mockPromise = Promise.resolve(options.queryResult || { data: null, error: null });
  queryChain.then = (onfulfilled: any, onrejected: any) => mockPromise.then(onfulfilled, onrejected);

  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: options.claims ? { claims: options.claims } : { claims: null },
      }),
    },
    from: vi.fn().mockReturnValue(queryChain),
  };
}

describe("tickets actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("submitTicket", () => {
    it("calls provisionClient with correct email and ticketId after successful insert", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          queryResult: { data: { id: "ticket-abc" }, error: null },
        }) as any
      );

      const formData = new FormData();
      formData.set("name", "Juan Perez");
      formData.set("email", "client@test.com");
      formData.set("subject", "Help me");
      formData.set("description", "Details here");

      const result = await submitTicket({ error: null }, formData);

      expect(result.error).toBeNull();
      expect(result.ticketId).toBe("ticket-abc");
      expect(mockProvisionClient).toHaveBeenCalledWith("client@test.com", "ticket-abc");
    });

    it("returns error when DB insert fails", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          queryResult: { data: null, error: { message: "DB error" } },
        }) as any
      );

      const formData = new FormData();
      formData.set("email", "fail@test.com");
      formData.set("subject", "Failing ticket");
      formData.set("description", "Fail");

      const result = await submitTicket({ error: null }, formData);

      expect(result.error).toBe("DB error");
      expect(mockProvisionClient).not.toHaveBeenCalled();
    });
  });

  describe("getTickets", () => {
    it("allows staff (admin/it) to fetch tickets", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: { role: "it" },
          queryResult: { data: [{ id: "ticket-1" }], error: null },
        }) as any
      );

      const tickets = await getTickets({});
      expect(tickets).toHaveLength(1);
      expect(tickets[0].id).toBe("ticket-1");
    });

    it("throws error if client attempts to fetch all tickets", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: { role: "client" },
        }) as any
      );

      await expect(getTickets({})).rejects.toThrow("Not authorized");
    });
  });

  describe("getTicketDetail", () => {
    it("allows clients to fetch their own ticket if email matches", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: { role: "client", email: "my-email@test.com" },
          queryResult: { data: { id: "ticket-1", email: "my-email@test.com" }, error: null },
        }) as any
      );

      const ticket = await getTicketDetail("ticket-1");
      expect(ticket.id).toBe("ticket-1");
    });

    it("throws error for clients if ticket email does not match client email", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: { role: "client", email: "other@test.com" },
          queryResult: { data: null, error: { message: "No rows found" } },
        }) as any
      );

      await expect(getTicketDetail("ticket-1")).rejects.toThrow("Ticket not found or access denied");
    });

    it("triggers auto-assignment to staff if ticket is open and unassigned", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: { role: "it", sub: "staff-uuid" },
          updateResult: { data: { id: "ticket-1", assigned_to: "staff-uuid", status: "in_progress" }, error: null },
        }) as any
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
          claims: { role: "it", sub: "staff-uuid" },
          updateResult: null,
          queryResult: { data: { id: "ticket-1", assigned_to: "other-staff-uuid", status: "in_progress" }, error: null },
        }) as any
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
          claims: { role: "admin" },
          queryResult: { data: { id: "ticket-1", status: "closed", closure_reason: "Fixed" }, error: null },
        }) as any
      );

      const ticket = await updateTicketStatus("ticket-1", "closed", "Fixed");
      expect(ticket.status).toBe("closed");
      expect(ticket.closure_reason).toBe("Fixed");
    });

    it("throws error when updating status to closed without a closure reason", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: { role: "admin" },
        }) as any
      );

      await expect(updateTicketStatus("ticket-1", "closed")).rejects.toThrow("Closure reason is required when status is closed");
    });
  });

  describe("assignTicket", () => {
    it("allows staff to change ticket assignment", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: { role: "it" },
          queryResult: { data: { id: "ticket-1", assigned_to: "new-staff-id" }, error: null },
        }) as any
      );

      const ticket = await assignTicket("ticket-1", "new-staff-id");
      expect(ticket.assigned_to).toBe("new-staff-id");
    });
  });

  describe("getCategories", () => {
    it("returns only enabled categories for clients", async () => {
      const mockSupabase = makeSupabaseMock({
        claims: { role: "client" },
        queryResult: { data: [{ id: "cat-1", is_enabled: true }], error: null },
      });
      mockCreateClient.mockResolvedValue(mockSupabase as any);

      const categories = await getCategories();
      expect(categories).toHaveLength(1);
      expect(mockSupabase.from().select().eq).toHaveBeenCalledWith("is_enabled", true);
    });

    it("returns all categories for staff", async () => {
      const mockSupabase = makeSupabaseMock({
        claims: { role: "it" },
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
          claims: { role: "it" },
          queryResult: { data: [{ id: "staff-1", display_name: "Juan" }], error: null },
        }) as any
      );

      const staff = await getStaffUsers();
      expect(staff).toHaveLength(1);
      expect(staff[0].display_name).toBe("Juan");
    });
  });
});
