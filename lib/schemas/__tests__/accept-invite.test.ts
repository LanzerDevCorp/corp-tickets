import { describe, it, expect } from "vitest";
import { acceptInviteSchema } from "@/lib/schemas/accept-invite";

describe("acceptInviteSchema", () => {
  it("accepts valid input", () => {
    const result = acceptInviteSchema.safeParse({
      name: "Jane Doe",
      password: "SecurePass1!",
      confirmPassword: "SecurePass1!",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short name", () => {
    const result = acceptInviteSchema.safeParse({
      name: "J",
      password: "SecurePass1!",
      confirmPassword: "SecurePass1!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = acceptInviteSchema.safeParse({
      name: "Jane Doe",
      password: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched passwords", () => {
    const result = acceptInviteSchema.safeParse({
      name: "Jane Doe",
      password: "SecurePass1!",
      confirmPassword: "OtherPass1!",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("confirmPassword");
    }
  });
});
