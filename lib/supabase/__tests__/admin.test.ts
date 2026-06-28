import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("supabaseAdmin", () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "window", {
      value: originalWindow,
      writable: true,
    });
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("exports a valid Supabase client in server context", async () => {
    // Ensure window is undefined (server context)
    Object.defineProperty(globalThis, "window", {
      value: undefined,
      writable: true,
    });
    const { supabaseAdmin } = await import("../admin");
    expect(supabaseAdmin).toBeDefined();
    expect(typeof supabaseAdmin.auth).toBe("object");
    expect(typeof supabaseAdmin.from).toBe("function");
  });

  it("throws when called in browser context", async () => {
    Object.defineProperty(globalThis, "window", {
      value: {},
      writable: true,
    });
    await expect(() => import("../admin")).rejects.toThrow(/server/i);
  });

  it("throws when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    Object.defineProperty(globalThis, "window", {
      value: undefined,
      writable: true,
    });
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await expect(() => import("../admin")).rejects.toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/i,
    );
  });
});
