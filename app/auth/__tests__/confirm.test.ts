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

function makeSupabaseMock(verifyOtpResult: { error: { message: string } | null }) {
  return {
    auth: {
      verifyOtp: vi.fn().mockResolvedValue(verifyOtpResult),
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
      makeSupabaseMock({ error: null }) as never
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
      makeSupabaseMock({ error: null }) as never
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

  it("redirects to error page on expired magiclink token", async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabaseMock({ error: { message: "Token has expired" } }) as never
    );

    const req = makeRequest({
      token_hash: "expired-hash",
      type: "magiclink",
    });

    try {
      await GET(req as never);
    } catch (e: unknown) {
      expect((e as Error).message).toContain(
        "REDIRECT:/auth/error?error_code=otp_expired"
      );
    }
  });
});
