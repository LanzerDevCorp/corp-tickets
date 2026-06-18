import { describe, it, expect } from "vitest";
import { getPostLoginRedirect, isSafeRedirect } from "../redirect";

describe("isSafeRedirect", () => {
  it("allows same-origin paths", () => {
    expect(isSafeRedirect("/tickets")).toBe(true);
    expect(isSafeRedirect("/dashboard")).toBe(true);
    expect(isSafeRedirect("/track/abc-123")).toBe(true);
  });

  it("blocks external URLs", () => {
    expect(isSafeRedirect("https://evil.com")).toBe(false);
    expect(isSafeRedirect("http://evil.com/steal")).toBe(false);
  });

  it("blocks URLs with protocol-relative or double-slash", () => {
    expect(isSafeRedirect("//evil.com")).toBe(false);
  });

  it("blocks /auth/login to avoid infinite redirect", () => {
    expect(isSafeRedirect("/auth/login")).toBe(false);
  });
});

describe("getPostLoginRedirect", () => {
  it("staff with safe next returns next", () => {
    expect(getPostLoginRedirect("admin", "/tickets")).toBe("/tickets");
    expect(getPostLoginRedirect("it", "/dashboard/settings")).toBe("/dashboard/settings");
  });

  it("client with no next returns /track", () => {
    expect(getPostLoginRedirect("client", null)).toBe("/track");
    expect(getPostLoginRedirect("client", undefined)).toBe("/track");
  });

  it("staff with no next returns /dashboard", () => {
    expect(getPostLoginRedirect("admin", null)).toBe("/dashboard");
    expect(getPostLoginRedirect("it")).toBe("/dashboard");
  });

  it("rejects external next and falls back to role default", () => {
    expect(getPostLoginRedirect("admin", "https://evil.com")).toBe("/dashboard");
    expect(getPostLoginRedirect("client", "https://evil.com")).toBe("/track");
  });

  it("rejects /auth/login as next (avoids loop)", () => {
    expect(getPostLoginRedirect("admin", "/auth/login")).toBe("/dashboard");
  });
});
