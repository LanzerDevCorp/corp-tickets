import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        getUserByEmail: vi.fn(),
        createUser: vi.fn(),
        generateLink: vi.fn(),
      },
      signInWithOtp: vi.fn(),
    },
  },
}));

import { provisionClient, requestMagicLink } from "../client-provision";
import { supabaseAdmin } from "@/lib/supabase/admin";

const mockGetUserByEmail = vi.mocked(supabaseAdmin.auth.admin.getUserByEmail);
const mockCreateUser = vi.mocked(supabaseAdmin.auth.admin.createUser);
const mockGenerateLink = vi.mocked(supabaseAdmin.auth.admin.generateLink);

describe("provisionClient", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates user and sends magic link for new email", async () => {
    mockGetUserByEmail.mockResolvedValue({ data: { user: null }, error: null } as never);
    mockCreateUser.mockResolvedValue({
      data: { user: { id: "new-user-id" } },
      error: null,
    } as never);
    mockGenerateLink.mockResolvedValue({ data: {}, error: null } as never);

    const result = await provisionClient("new@client.com", "ticket-abc");

    expect(result.alreadyExisted).toBe(false);
    expect(result.userId).toBe("new-user-id");
    expect(result.error).toBeNull();
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new@client.com",
        email_confirm: true,
        app_metadata: { role: "client" },
      })
    );
    expect(mockGenerateLink).toHaveBeenCalledWith(
      expect.objectContaining({ type: "magiclink", email: "new@client.com" })
    );
  });

  it("skips createUser for existing client and sends magic link", async () => {
    mockGetUserByEmail.mockResolvedValue({
      data: { user: { id: "existing-user-id" } },
      error: null,
    } as never);
    mockGenerateLink.mockResolvedValue({ data: {}, error: null } as never);

    const result = await provisionClient("existing@client.com", "ticket-xyz");

    expect(result.alreadyExisted).toBe(true);
    expect(result.userId).toBe("existing-user-id");
    expect(result.error).toBeNull();
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("returns validation error for invalid email without Supabase call", async () => {
    const result = await provisionClient("not-an-email", "ticket-123");

    expect(result.error).toMatch(/invalid email/i);
    expect(result.userId).toBeNull();
    expect(mockGetUserByEmail).not.toHaveBeenCalled();
  });

  it("propagates Supabase error", async () => {
    mockGetUserByEmail.mockResolvedValue({ data: { user: null }, error: null } as never);
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
  beforeEach(() => vi.clearAllMocks());

  it("generates a magic link for existing email", async () => {
    mockGenerateLink.mockResolvedValue({ data: {}, error: null } as never);

    const result = await requestMagicLink("existing@client.com");

    expect(result.error).toBeNull();
    expect(mockGenerateLink).toHaveBeenCalledWith(
      expect.objectContaining({ type: "magiclink", email: "existing@client.com" })
    );
  });

  it("returns error when generation fails", async () => {
    mockGenerateLink.mockResolvedValue({
      data: null,
      error: { message: "Rate limit exceeded" },
    } as never);

    const result = await requestMagicLink("client@example.com");

    expect(result.error).toBe("Rate limit exceeded");
  });
});
