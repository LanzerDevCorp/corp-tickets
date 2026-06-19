import { describe, it, expect } from "vitest";
import { getAppRoleFromClaims } from "../claims";

describe("getAppRoleFromClaims", () => {
  it("reads app_role claim", () => {
    expect(getAppRoleFromClaims({ app_role: "admin" })).toBe("admin");
  });

  it("falls back to app_metadata.role", () => {
    expect(getAppRoleFromClaims({ app_metadata: { role: "it" } })).toBe("it");
  });

  it("prefers app_role over app_metadata.role", () => {
    expect(
      getAppRoleFromClaims({ app_role: "admin", app_metadata: { role: "it" } })
    ).toBe("admin");
  });

  it("defaults to client when missing or invalid", () => {
    expect(getAppRoleFromClaims(null)).toBe("client");
    expect(getAppRoleFromClaims({})).toBe("client");
    expect(getAppRoleFromClaims({ app_role: "authenticated" })).toBe("client");
  });
});
