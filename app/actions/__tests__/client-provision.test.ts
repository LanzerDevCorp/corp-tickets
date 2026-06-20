import { describe, it, expect, vi, beforeEach } from "vitest";

const mockMaybeSingle = vi.hoisted(() => vi.fn());
const mockUsersQueryChain = vi.hoisted(() => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: mockMaybeSingle,
}));

const mockTicketsMaybeSingle = vi.hoisted(() => vi.fn());
const mockTicketsQueryChain = vi.hoisted(() => ({
  select: vi.fn().mockReturnThis(),
  ilike: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  maybeSingle: mockTicketsMaybeSingle,
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === "tickets") return mockTicketsQueryChain;
      return mockUsersQueryChain;
    }),
    auth: {
      admin: {
        createUser: vi.fn(),
      },
    },
  },
}));

vi.mock("@/lib/notifications/tickets", () => ({
  sendTicketAccessEmail: vi.fn(),
}));

import { provisionClient, requestMagicLink } from "../client-provision";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendTicketAccessEmail } from "@/lib/notifications/tickets";
import { buildTicketAccessUrl } from "@/lib/auth/ticket-access";

const mockCreateUser = vi.mocked(supabaseAdmin.auth.admin.createUser);
const mockSendTicketAccessEmail = vi.mocked(sendTicketAccessEmail);

describe("provisionClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SITE_URL = "https://corp-tickets.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  });

  it("creates user and returns reusable ticket access link for new email", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockCreateUser.mockResolvedValue({
      data: { user: { id: "new-user-id" } },
      error: null,
    } as never);

    const result = await provisionClient("new@client.com", "ticket-abc");

    expect(result.alreadyExisted).toBe(false);
    expect(result.userId).toBe("new-user-id");
    expect(result.actionLink).toBe(
      buildTicketAccessUrl("ticket-abc", "new@client.com")
    );
    expect(result.actionLink).toContain("/auth/ticket-access?");
    expect(result.error).toBeNull();
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new@client.com",
        email_confirm: true,
        app_metadata: { role: "client" },
      })
    );
  });

  it("skips createUser for existing client and returns reusable access link", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: "existing-user-id" },
      error: null,
    });

    const result = await provisionClient("existing@client.com", "ticket-xyz");

    expect(result.alreadyExisted).toBe(true);
    expect(result.userId).toBe("existing-user-id");
    expect(result.actionLink).toBe(
      buildTicketAccessUrl("ticket-xyz", "existing@client.com")
    );
    expect(result.error).toBeNull();
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("returns validation error for invalid email without Supabase call", async () => {
    const result = await provisionClient("not-an-email", "ticket-123");

    expect(result.error).toMatch(/correo/i);
    expect(result.userId).toBeNull();
    expect(result.actionLink).toBeNull();
  });

  it("propagates Supabase error", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockCreateUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Database error" },
    } as never);

    const result = await provisionClient("fail@client.com", "ticket-err");

    expect(result.error).toBe("Database error");
    expect(result.userId).toBeNull();
  });
});

describe("requestMagicLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends ticket access email for latest ticket (case-insensitive email)", async () => {
    mockTicketsMaybeSingle.mockResolvedValue({
      data: { id: "ticket-abc" },
      error: null,
    });
    mockSendTicketAccessEmail.mockResolvedValue({ error: null });

    const result = await requestMagicLink("Existing@Client.com");

    expect(result.error).toBeNull();
    expect(mockTicketsQueryChain.ilike).toHaveBeenCalledWith(
      "email",
      "Existing@Client.com"
    );
    expect(mockSendTicketAccessEmail).toHaveBeenCalledWith("ticket-abc");
  });

  it("returns null error when no ticket exists (no enumeration)", async () => {
    mockTicketsMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await requestMagicLink("unknown@client.com");

    expect(result.error).toBeNull();
    expect(mockSendTicketAccessEmail).not.toHaveBeenCalled();
  });

  it("returns error when email delivery fails", async () => {
    mockTicketsMaybeSingle.mockResolvedValue({
      data: { id: "ticket-abc" },
      error: null,
    });
    mockSendTicketAccessEmail.mockResolvedValue({
      error: "No pudimos enviar el enlace. Intenta de nuevo en unos minutos.",
    });

    const result = await requestMagicLink("client@example.com");

    expect(result.error).toMatch(/no pudimos enviar/i);
  });

  it("returns validation error for invalid email", async () => {
    const result = await requestMagicLink("not-an-email");

    expect(result.error).toMatch(/correo/i);
    expect(mockSendTicketAccessEmail).not.toHaveBeenCalled();
  });
});
