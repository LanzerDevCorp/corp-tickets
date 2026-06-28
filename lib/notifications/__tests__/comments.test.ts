import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

vi.mock("@/lib/resend", () => ({
  resend: {
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: "e1" }, error: null }),
    },
  },
}));

vi.mock("@react-email/components", async (importActual) => {
  const actual = await importActual<typeof import("@react-email/components")>();
  return { ...actual, render: vi.fn().mockResolvedValue("<html>email</html>") };
});

import { notifyPublicComment, notifyClientComment } from "../comments";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resend } from "@/lib/resend";

const mockFrom = vi.mocked(supabaseAdmin.from);
const mockSend = vi.mocked(resend!.emails.send);

// ---------------------------------------------------------------------------
// Chain helpers
// ---------------------------------------------------------------------------

function makeChain(result: unknown) {
  const chain: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    then: (
      res: (v: unknown) => unknown,
      rej: (e: unknown) => unknown,
    ) => Promise<unknown>;
  } = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    then: (res, rej) => Promise.resolve(result).then(res, rej),
  };
  return chain;
}

function mockTables(map: Record<string, unknown>) {
  mockFrom.mockImplementation(
    (table: string) =>
      makeChain(map[table]) as unknown as ReturnType<typeof supabaseAdmin.from>,
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("RESEND_FROM_EMAIL", "support@corp.test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// notifyPublicComment
// ---------------------------------------------------------------------------

describe("notifyPublicComment", () => {
  it("sends to client email with correct subject, from, and html when cc_emails is empty", async () => {
    mockTables({
      comments: {
        data: {
          body: "We fixed it.",
          cc_emails: [],
          tickets: {
            email: "client@example.com",
            name: "Alice",
            subject: "Login issue",
          },
        },
        error: null,
      },
    });

    await notifyPublicComment("comment-1", "ticket-1");

    expect(mockSend).toHaveBeenCalledTimes(1);
    const call = mockSend.mock.calls[0][0];
    expect(call.to).toBe("client@example.com");
    expect(call.from).toBe("support@corp.test");
    expect(call.subject).toContain("Login issue");
    expect(call.html).toBe("<html>email</html>");
    expect(call.cc).toBeUndefined();
  });

  it("deduplicates cc_emails, excludes primary to address", async () => {
    mockTables({
      comments: {
        data: {
          body: "We fixed it.",
          cc_emails: [
            "client@example.com",
            "cc1@example.com",
            "cc1@example.com",
          ],
          tickets: {
            email: "client@example.com",
            name: "Alice",
            subject: "Login issue",
          },
        },
        error: null,
      },
    });

    await notifyPublicComment("comment-1", "ticket-1");

    expect(mockSend).toHaveBeenCalledTimes(1);
    const call = mockSend.mock.calls[0][0];
    expect(call.to).toBe("client@example.com");
    expect(call.cc).toEqual(["cc1@example.com"]);
  });

  it("returns without sending when Supabase returns null data", async () => {
    mockTables({
      comments: { data: null, error: { message: "not found" } },
    });

    await notifyPublicComment("comment-1", "ticket-1");

    expect(mockSend).not.toHaveBeenCalled();
  });

  it("returns without sending when RESEND_FROM_EMAIL is unset", async () => {
    vi.stubEnv("RESEND_FROM_EMAIL", "");

    mockTables({
      comments: {
        data: {
          body: "We fixed it.",
          cc_emails: [],
          tickets: {
            email: "client@example.com",
            name: "Alice",
            subject: "Login issue",
          },
        },
        error: null,
      },
    });

    await notifyPublicComment("comment-1", "ticket-1");

    expect(mockSend).not.toHaveBeenCalled();
  });

  it("swallows error when resend.emails.send rejects", async () => {
    mockTables({
      comments: {
        data: {
          body: "We fixed it.",
          cc_emails: [],
          tickets: {
            email: "client@example.com",
            name: "Alice",
            subject: "Login issue",
          },
        },
        error: null,
      },
    });

    mockSend.mockRejectedValueOnce(new Error("auth error"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      notifyPublicComment("comment-1", "ticket-1"),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// notifyClientComment
// ---------------------------------------------------------------------------

describe("notifyClientComment", () => {
  it("sends to assignee when ticket has assigned_to", async () => {
    mockTables({
      tickets: {
        data: {
          subject: "Printer broken",
          name: "Bob",
          assigned_to: "staff-uuid-1",
          users: { email: "staff@corp.test", display_name: "Staff" },
        },
        error: null,
      },
      comments: {
        data: { body: "Still broken.", cc_emails: [] },
        error: null,
      },
    });

    await notifyClientComment("comment-2", "ticket-2");

    expect(mockSend).toHaveBeenCalledTimes(1);
    const call = mockSend.mock.calls[0][0];
    expect(call.to).toEqual(["staff@corp.test"]);
    expect(call.subject).toContain("Printer broken");
    expect(call.html).toBe("<html>email</html>");
  });

  it("sends to all IT+admin users when assigned_to is null", async () => {
    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "tickets") {
        return makeChain({
          data: {
            subject: "Broken VPN",
            name: "Ada",
            assigned_to: null,
            users: null,
          },
          error: null,
        }) as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      if (table === "users") {
        callCount++;
        // users table: no .single(), resolves directly via .in()
        const chain = {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [{ email: "it1@corp.test" }, { email: "admin@corp.test" }],
            error: null,
          }),
        };
        return chain as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      // comments
      return makeChain({
        data: { body: "Still failing", cc_emails: [] },
        error: null,
      }) as unknown as ReturnType<typeof supabaseAdmin.from>;
    });

    await notifyClientComment("comment-2", "ticket-2");

    expect(mockSend).toHaveBeenCalledTimes(1);
    const call = mockSend.mock.calls[0][0];
    expect(call.to).toContain("it1@corp.test");
    expect(call.to).toContain("admin@corp.test");
  });

  it("returns without sending when no recipients exist (unassigned + empty staff)", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "tickets") {
        return makeChain({
          data: {
            subject: "Broken VPN",
            name: "Ada",
            assigned_to: null,
            users: null,
          },
          error: null,
        }) as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      if (table === "users") {
        const chain = {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
        return chain as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      return makeChain({
        data: { body: "Test", cc_emails: [] },
        error: null,
      }) as unknown as ReturnType<typeof supabaseAdmin.from>;
    });

    await notifyClientComment("comment-2", "ticket-2");

    expect(mockSend).not.toHaveBeenCalled();
  });

  it("deduplicates cc_emails against full recipient set", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "tickets") {
        return makeChain({
          data: {
            subject: "Broken VPN",
            name: "Ada",
            assigned_to: null,
            users: null,
          },
          error: null,
        }) as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      if (table === "users") {
        const chain = {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [{ email: "it1@corp.test" }],
            error: null,
          }),
        };
        return chain as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      // comments
      return makeChain({
        data: {
          body: "Still failing",
          cc_emails: [
            "it1@corp.test",
            "external@example.com",
            "external@example.com",
          ],
        },
        error: null,
      }) as unknown as ReturnType<typeof supabaseAdmin.from>;
    });

    await notifyClientComment("comment-2", "ticket-2");

    expect(mockSend).toHaveBeenCalledTimes(1);
    const call = mockSend.mock.calls[0][0];
    expect(call.to).toContain("it1@corp.test");
    expect(call.cc).toEqual(["external@example.com"]);
  });

  it("swallows error when send rejects in notifyClientComment", async () => {
    mockTables({
      tickets: {
        data: {
          subject: "Printer broken",
          name: "Bob",
          assigned_to: "staff-uuid-1",
          users: { email: "staff@corp.test", display_name: "Staff" },
        },
        error: null,
      },
      comments: {
        data: { body: "Still broken.", cc_emails: [] },
        error: null,
      },
    });

    mockSend.mockRejectedValueOnce(new Error("send failed"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      notifyClientComment("comment-2", "ticket-2"),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
