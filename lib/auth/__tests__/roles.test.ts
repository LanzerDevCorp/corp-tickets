import { describe, it, expect } from "vitest";
import {
  isStaff,
  isAdmin,
  getRedirectPath,
  hasAccess,
  STAFF_ROLES,
  ALL_ROLES,
} from "../roles";
import type { Role } from "../roles";

describe("isStaff", () => {
  it("returns true for admin", () => {
    expect(isStaff("admin")).toBe(true);
  });

  it("returns true for it", () => {
    expect(isStaff("it")).toBe(true);
  });

  it("returns false for client", () => {
    expect(isStaff("client")).toBe(false);
  });
});

describe("isAdmin", () => {
  it("returns true for admin", () => {
    expect(isAdmin("admin")).toBe(true);
  });

  it("returns false for it", () => {
    expect(isAdmin("it")).toBe(false);
  });

  it("returns false for client", () => {
    expect(isAdmin("client")).toBe(false);
  });
});

describe("getRedirectPath", () => {
  it("returns /dashboard for admin", () => {
    expect(getRedirectPath("admin")).toBe("/dashboard");
  });

  it("returns /dashboard for it", () => {
    expect(getRedirectPath("it")).toBe("/dashboard");
  });

  it("returns /track for client", () => {
    expect(getRedirectPath("client")).toBe("/track");
  });
});

describe("hasAccess", () => {
  it("returns false when client tries to access admin+it route", () => {
    expect(hasAccess("client", ["admin", "it"])).toBe(false);
  });

  it("returns true when admin is in allowed roles", () => {
    expect(hasAccess("admin", ["admin", "it"])).toBe(true);
  });

  it("returns true when it is in allowed roles", () => {
    expect(hasAccess("it", ["admin", "it"])).toBe(true);
  });

  it("returns true when client is in allowed roles", () => {
    expect(hasAccess("client", ["admin", "it", "client"])).toBe(true);
  });
});

describe("constants", () => {
  it("STAFF_ROLES contains admin and it", () => {
    expect(STAFF_ROLES).toContain("admin");
    expect(STAFF_ROLES).toContain("it");
    expect(STAFF_ROLES).not.toContain("client");
  });

  it("ALL_ROLES contains all three roles", () => {
    expect(ALL_ROLES).toHaveLength(3);
    const roles: Role[] = ["admin", "it", "client"];
    for (const r of roles) {
      expect(ALL_ROLES).toContain(r);
    }
  });
});
