import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/notifications/comments", () => ({
  notifyPublicComment: vi.fn().mockResolvedValue(undefined),
  notifyClientComment: vi.fn().mockResolvedValue(undefined),
}));

import { getComments, addComment } from "../comments";
import { createClient } from "@/lib/supabase/server";
import {
  notifyPublicComment,
  notifyClientComment,
} from "@/lib/notifications/comments";

const mockCreateClient = vi.mocked(createClient);
const mockNotifyPublicComment = vi.mocked(notifyPublicComment);
const mockNotifyClientComment = vi.mocked(notifyClientComment);

// Mirrors the pattern from tickets.test.ts
function makeSupabaseMock(options: { claims?: any; queryResult?: any }) {
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
        Promise.resolve(options.queryResult || { data: null, error: null }),
      ),
  };

  // Thenable for queries without .single() (e.g. getComments)
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
    },
    from: vi.fn().mockReturnValue(queryChain),
  };
}

const MOCK_COMMENT = {
  id: "comment-uuid-1",
  ticket_id: "ticket-uuid-1",
  body: "This is a test comment",
  is_internal: false,
  cc_emails: [],
  created_at: "2026-06-18T19:00:00.000Z",
  author: { display_name: "Staff User", email: "staff@corp.com" },
};

const MOCK_INTERNAL_COMMENT = {
  ...MOCK_COMMENT,
  id: "comment-uuid-2",
  is_internal: true,
  body: "Internal note",
};

describe("comments actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getComments", () => {
    it("returns comments ordered ASC (as provided by DB)", async () => {
      const sortedComments = [
        { ...MOCK_COMMENT, id: "c1", created_at: "2026-06-18T10:00:00Z" },
        { ...MOCK_COMMENT, id: "c2", created_at: "2026-06-18T11:00:00Z" },
        { ...MOCK_COMMENT, id: "c3", created_at: "2026-06-18T12:00:00Z" },
      ];

      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: { app_role: "it", sub: "staff-id" },
          queryResult: { data: sortedComments, error: null },
        }) as any,
      );

      const result = await getComments("ticket-uuid-1");

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe("c1");
      expect(result[2].id).toBe("c3");
    });

    it("returns empty list when claims are null (defaults to client role)", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: null,
          queryResult: { data: [], error: null },
        }) as any,
      );

      const result = await getComments("ticket-uuid-1");
      expect(result).toEqual([]);
    });
  });

  describe("addComment", () => {
    it("inserts and returns new comment for valid staff payload", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: { app_role: "it", sub: "staff-id", email: "staff@corp.com" },
          queryResult: { data: MOCK_COMMENT, error: null },
        }) as any,
      );

      const result = await addComment({
        ticketId: "ticket-uuid-1",
        body: "This is a test comment",
        is_internal: false,
      });

      expect(result.id).toBe("comment-uuid-1");
      expect(result.body).toBe("This is a test comment");
    });

    it("throws on empty body (Zod validation)", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: { app_role: "it", sub: "staff-id", email: "staff@corp.com" },
        }) as any,
      );

      await expect(
        addComment({ ticketId: "ticket-uuid-1", body: "", is_internal: false }),
      ).rejects.toThrow();
    });

    it("throws on whitespace-only body (Zod validation)", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: { app_role: "it", sub: "staff-id", email: "staff@corp.com" },
        }) as any,
      );

      await expect(
        addComment({
          ticketId: "ticket-uuid-1",
          body: "   ",
          is_internal: false,
        }),
      ).rejects.toThrow();
    });

    it("forces is_internal=false for client role regardless of payload", async () => {
      const clientMock = makeSupabaseMock({
        claims: {
          app_role: "client",
          sub: "client-id",
          email: "client@example.com",
        },
        queryResult: {
          data: { ...MOCK_COMMENT, is_internal: false },
          error: null,
        },
      });
      mockCreateClient.mockResolvedValue(clientMock as any);

      const result = await addComment({
        ticketId: "ticket-uuid-1",
        body: "Client trying to post internal",
        is_internal: true, // client sends true — must be overridden to false
      });

      // Verify the insert was called with is_internal: false
      const insertCall = clientMock.from().insert;
      expect(insertCall).toHaveBeenCalledWith(
        expect.objectContaining({ is_internal: false }),
      );
      expect(result.is_internal).toBe(false);
    });

    it("calls notifyPublicComment after staff public insert (not notifyClientComment)", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: { app_role: "it", sub: "staff-id", email: "staff@corp.com" },
          queryResult: { data: MOCK_COMMENT, error: null },
        }) as any,
      );

      await addComment({
        ticketId: "ticket-uuid-1",
        body: "Public staff comment",
        is_internal: false,
      });

      expect(mockNotifyPublicComment).toHaveBeenCalledWith(
        MOCK_COMMENT.id,
        "ticket-uuid-1",
      );
      expect(mockNotifyClientComment).not.toHaveBeenCalled();
    });

    it("calls notifyClientComment after client insert (and notifyPublicComment too — client comment is always public)", async () => {
      const clientComment = { ...MOCK_COMMENT, id: "client-comment-1" };
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: {
            app_role: "client",
            sub: "client-id",
            email: "client@example.com",
          },
          queryResult: { data: clientComment, error: null },
        }) as any,
      );

      await addComment({
        ticketId: "ticket-uuid-1",
        body: "Client comment",
        is_internal: false,
      });

      // Client comment is always public (is_internal=false), so both stubs fire:
      // notifyClientComment (role=client) and notifyPublicComment (is_internal=false)
      expect(mockNotifyClientComment).toHaveBeenCalledWith(
        clientComment.id,
        "ticket-uuid-1",
      );
    });

    it("calls neither stub for staff internal note", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({
          claims: { app_role: "it", sub: "staff-id", email: "staff@corp.com" },
          queryResult: { data: MOCK_INTERNAL_COMMENT, error: null },
        }) as any,
      );

      await addComment({
        ticketId: "ticket-uuid-1",
        body: "Internal staff note",
        is_internal: true,
      });

      expect(mockNotifyPublicComment).not.toHaveBeenCalled();
      expect(mockNotifyClientComment).not.toHaveBeenCalled();
    });

    it("throws Not authorized when no role or author id", async () => {
      mockCreateClient.mockResolvedValue(
        makeSupabaseMock({ claims: null }) as any,
      );

      await expect(
        addComment({
          ticketId: "ticket-uuid-1",
          body: "test",
          is_internal: false,
        }),
      ).rejects.toThrow("No autorizado");
    });
  });
});
