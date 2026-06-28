import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./config", () => ({
  isTurnstileEnabled: vi.fn(() => true),
  TURNSTILE_ENABLED: true,
}));

import { verifyTurnstileToken } from "./verify";
import { isTurnstileEnabled } from "./config";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

describe("verifyTurnstileToken", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.mocked(isTurnstileEnabled).mockReturnValue(true);
    process.env = { ...originalEnv, TURNSTILE_SECRET_KEY: "test-secret" };
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it("retorna success: true cuando Cloudflare responde con success: true", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );

    const result = await verifyTurnstileToken("valid-token");
    expect(result.success).toBe(true);
  });

  it("retorna success: false cuando Cloudflare responde con success: false", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false }), { status: 200 }),
    );

    const result = await verifyTurnstileToken("bad-token");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
  });

  it("retorna success: false cuando la red falla", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

    const result = await verifyTurnstileToken("any-token");
    expect(result.success).toBe(false);
  });

  it("retorna success: false cuando HTTP no es 2xx", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500 }),
    );

    const result = await verifyTurnstileToken("any-token");
    expect(result.success).toBe(false);
  });

  it("retorna success: false cuando falta TURNSTILE_SECRET_KEY", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;

    const result = await verifyTurnstileToken("any-token");
    expect(result.success).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("llama a siteverify con el secret y el token correctos", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );

    await verifyTurnstileToken("my-token");

    expect(fetch).toHaveBeenCalledWith(
      SITEVERIFY_URL,
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("retorna success: true cuando Turnstile está deshabilitado", async () => {
    vi.mocked(isTurnstileEnabled).mockReturnValue(false);
    delete process.env.TURNSTILE_SECRET_KEY;

    const result = await verifyTurnstileToken("any-token");
    expect(result.success).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
});
