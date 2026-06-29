import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { GET } from "../confirm/route";
import { createClient } from "@/lib/supabase/server";

const mockCreateClient = vi.mocked(createClient);

function makeSupabaseMock(
  verifyOtpResult: { error: { message: string } | null },
  options?: { hasUser?: boolean },
) {
  return {
    auth: {
      verifyOtp: vi.fn().mockResolvedValue(verifyOtpResult),
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: options?.hasUser
            ? { id: "user-1", email: "client@test.com" }
            : null,
        },
      }),
    },
  };
}

function makeRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/auth/confirm");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString());
}

describe("GET /auth/confirm — magiclink type", () => {
  beforeEach(() => vi.clearAllMocks());

  it("verifies OTP and redirects to /track for magiclink type", async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabaseMock({ error: null }) as never,
    );

    const req = makeRequest({
      token_hash: "valid-hash",
      type: "magiclink",
    });

    try {
      await GET(req as never);
    } catch (e: unknown) {
      expect((e as Error).message).toContain("REDIRECT:/track");
    }
  });

  it("redirects to /track/:ticketId when next param is provided", async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabaseMock({ error: null }) as never,
    );

    const req = makeRequest({
      token_hash: "valid-hash",
      type: "magiclink",
      next: "/track/abc-123",
    });

    try {
      await GET(req as never);
    } catch (e: unknown) {
      expect((e as Error).message).toContain("REDIRECT:/track/abc-123");
    }
  });

  it("redirects to error page on expired magiclink token without session", async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabaseMock({ error: { message: "Token has expired" } }) as never,
    );

    const req = makeRequest({
      token_hash: "expired-hash",
      type: "magiclink",
    });

    try {
      await GET(req as never);
    } catch (e: unknown) {
      expect((e as Error).message).toContain(
        "REDIRECT:/track/access?error_code=otp_expired",
      );
    }
  });

  it("redirects to next when magiclink token expired but session already exists", async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabaseMock(
        { error: { message: "Token has expired" } },
        { hasUser: true },
      ) as never,
    );

    const req = makeRequest({
      token_hash: "expired-hash",
      type: "magiclink",
      next: "/track/abc-123",
    });

    try {
      await GET(req as never);
    } catch (e: unknown) {
      expect((e as Error).message).toContain("REDIRECT:/track/abc-123");
    }
  });
});

describe("GET /auth/confirm — invite type", () => {
  beforeEach(() => vi.clearAllMocks());

  it("verifies OTP and redirects to /auth/accept-invite", async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabaseMock({ error: null }) as never,
    );

    const req = makeRequest({
      token_hash: "valid-hash",
      type: "invite",
    });

    try {
      await GET(req as never);
    } catch (e: unknown) {
      expect((e as Error).message).toContain("REDIRECT:/auth/accept-invite");
    }
  });

  it("honours next param for invite when safe", async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabaseMock({ error: null }) as never,
    );

    const req = makeRequest({
      token_hash: "valid-hash",
      type: "invite",
      next: "/auth/accept-invite",
    });

    try {
      await GET(req as never);
    } catch (e: unknown) {
      expect((e as Error).message).toContain("REDIRECT:/auth/accept-invite");
    }
  });
});

describe("GET /auth/confirm — recovery type", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects to /auth/update-password", async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabaseMock({ error: null }) as never,
    );

    const req = makeRequest({
      token_hash: "valid-hash",
      type: "recovery",
    });

    try {
      await GET(req as never);
    } catch (e: unknown) {
      expect((e as Error).message).toContain("REDIRECT:/auth/update-password");
    }
  });
});
