import { describe, it, expect } from "vitest";
import { isPendingStaffInvite, isStaffRole } from "../staff-invite";

describe("isStaffRole", () => {
  it("returns true for admin and it", () => {
    expect(isStaffRole("admin")).toBe(true);
    expect(isStaffRole("it")).toBe(true);
  });

  it("returns false for client", () => {
    expect(isStaffRole("client")).toBe(false);
  });
});

describe("isPendingStaffInvite", () => {
  it("returns true for invited staff without confirmed email", () => {
    expect(
      isPendingStaffInvite(
        { invited_at: "2026-01-01T00:00:00Z", email_confirmed_at: undefined },
        "admin",
      ),
    ).toBe(true);
  });

  it("returns false for confirmed staff", () => {
    expect(
      isPendingStaffInvite(
        {
          invited_at: "2026-01-01T00:00:00Z",
          email_confirmed_at: "2026-01-02T00:00:00Z",
        },
        "it",
      ),
    ).toBe(false);
  });

  it("returns false for clients even if unconfirmed", () => {
    expect(
      isPendingStaffInvite(
        { invited_at: undefined, email_confirmed_at: undefined },
        "client",
      ),
    ).toBe(false);
  });

  it("returns false when auth user is missing", () => {
    expect(isPendingStaffInvite(undefined, "admin")).toBe(false);
  });
});
