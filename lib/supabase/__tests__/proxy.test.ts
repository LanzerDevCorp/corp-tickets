import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from "@supabase/ssr";
import { updateSession } from "../proxy";

const mockCreateServerClient = vi.mocked(createServerClient);

function makeRequest(pathname: string, cookies: Record<string, string> = {}) {
  const url = new URL(`http://localhost${pathname}`);
  const req = new NextRequest(url);
  for (const [k, v] of Object.entries(cookies)) {
    req.cookies.set(k, v);
  }
  return req;
}

function makeSupabaseMock(claims: Record<string, unknown> | null) {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: claims ? { claims } : { claims: null },
      }),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-anon-key";
});

describe("updateSession — unauthenticated user", () => {
  it("redirects to /auth/login for protected route /dashboard", async () => {
    mockCreateServerClient.mockReturnValue(makeSupabaseMock(null) as never);

    const req = makeRequest("/dashboard");
    const res = await updateSession(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/login");
  });

  it("passes through for public route /", async () => {
    mockCreateServerClient.mockReturnValue(makeSupabaseMock(null) as never);

    const req = makeRequest("/");
    const res = await updateSession(req);

    expect(res.status).not.toBe(307);
  });

  it("passes through for /track/123 (public ticket tracking)", async () => {
    mockCreateServerClient.mockReturnValue(makeSupabaseMock(null) as never);

    const req = makeRequest("/track/123");
    const res = await updateSession(req);

    expect(res.status).not.toBe(307);
  });

  it("passes through for /auth routes", async () => {
    mockCreateServerClient.mockReturnValue(makeSupabaseMock(null) as never);

    const req = makeRequest("/auth/login");
    const res = await updateSession(req);

    expect(res.status).not.toBe(307);
  });

  it("passes through for /submit (public ticket submission)", async () => {
    mockCreateServerClient.mockReturnValue(makeSupabaseMock(null) as never);

    const req = makeRequest("/submit");
    const res = await updateSession(req);

    expect(res.status).not.toBe(307);
  });
});

describe("updateSession — client role", () => {
  it("redirects client to /403 when accessing staff-only /dashboard", async () => {
    mockCreateServerClient.mockReturnValue(
      makeSupabaseMock({ app_role: "client", email: "client@test.com" }) as never
    );

    const req = makeRequest("/dashboard");
    const res = await updateSession(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/403");
  });
});

describe("updateSession — admin role", () => {
  it("allows admin to access /dashboard", async () => {
    mockCreateServerClient.mockReturnValue(
      makeSupabaseMock({ app_role: "admin", email: "admin@corp.com" }) as never
    );

    const req = makeRequest("/dashboard");
    const res = await updateSession(req);

    expect(res.status).not.toBe(307);
  });
});

describe("updateSession — authenticated user on /auth/login", () => {
  it("redirects authenticated admin away from /auth/login to role default", async () => {
    mockCreateServerClient.mockReturnValue(
      makeSupabaseMock({ app_role: "admin", email: "admin@corp.com" }) as never
    );

    const req = makeRequest("/auth/login");
    const res = await updateSession(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/dashboard");
  });

  it("allows authenticated client to access /auth/login", async () => {
    mockCreateServerClient.mockReturnValue(
      makeSupabaseMock({ role: "client", email: "client@corp.com" }) as never
    );

    const req = makeRequest("/auth/login");
    const res = await updateSession(req);

    expect(res.status).not.toBe(307);
  });
});
