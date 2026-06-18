import { describe, it, expect } from "vitest";
import { CommentSubmitSchema } from "./comment-submit";

describe("CommentSubmitSchema", () => {
  it("accepts a valid payload", () => {
    const result = CommentSubmitSchema.safeParse({
      body: "This is a valid comment body.",
      is_internal: false,
      cc_emails: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid payload with cc_emails", () => {
    const result = CommentSubmitSchema.safeParse({
      body: "Another valid comment.",
      is_internal: true,
      cc_emails: ["cc@example.com", "another@test.org"],
    });
    expect(result.success).toBe(true);
  });

  it("applies default cc_emails of [] when not provided", () => {
    const result = CommentSubmitSchema.safeParse({
      body: "Comment without cc.",
      is_internal: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cc_emails).toEqual([]);
    }
  });

  describe("body", () => {
    it("rejects empty body", () => {
      const result = CommentSubmitSchema.safeParse({
        body: "",
        is_internal: false,
        cc_emails: [],
      });
      expect(result.success).toBe(false);
    });

    it("rejects whitespace-only body", () => {
      const result = CommentSubmitSchema.safeParse({
        body: "   ",
        is_internal: false,
        cc_emails: [],
      });
      expect(result.success).toBe(false);
    });

    it("rejects body exceeding 5000 characters", () => {
      const result = CommentSubmitSchema.safeParse({
        body: "a".repeat(5001),
        is_internal: false,
        cc_emails: [],
      });
      expect(result.success).toBe(false);
    });

    it("accepts body of exactly 5000 characters", () => {
      const result = CommentSubmitSchema.safeParse({
        body: "a".repeat(5000),
        is_internal: false,
        cc_emails: [],
      });
      expect(result.success).toBe(true);
    });
  });

  describe("is_internal", () => {
    it("rejects non-boolean is_internal (string 'true')", () => {
      const result = CommentSubmitSchema.safeParse({
        body: "Valid body",
        is_internal: "true",
        cc_emails: [],
      });
      expect(result.success).toBe(false);
    });

    it("rejects non-boolean is_internal (number 1)", () => {
      const result = CommentSubmitSchema.safeParse({
        body: "Valid body",
        is_internal: 1,
        cc_emails: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("cc_emails", () => {
    it("rejects invalid email in cc_emails array", () => {
      const result = CommentSubmitSchema.safeParse({
        body: "Valid body",
        is_internal: false,
        cc_emails: ["not-an-email"],
      });
      expect(result.success).toBe(false);
    });

    it("rejects array where one entry is invalid", () => {
      const result = CommentSubmitSchema.safeParse({
        body: "Valid body",
        is_internal: false,
        cc_emails: ["valid@example.com", "bad-email"],
      });
      expect(result.success).toBe(false);
    });

    it("accepts valid email addresses in cc_emails", () => {
      const result = CommentSubmitSchema.safeParse({
        body: "Valid body",
        is_internal: false,
        cc_emails: ["user@domain.com"],
      });
      expect(result.success).toBe(true);
    });
  });
});
