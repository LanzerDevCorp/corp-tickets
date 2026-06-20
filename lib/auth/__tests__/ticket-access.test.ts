import { describe, it, expect, beforeEach } from "vitest";
import {
  buildTicketAccessUrl,
  signTicketAccess,
  verifyTicketAccess,
} from "../ticket-access";

describe("ticket access signatures", () => {
  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    process.env.NEXT_PUBLIC_SITE_URL = "https://corp-tickets.test";
  });

  it("signs and verifies matching ticket/email pairs", () => {
    const sig = signTicketAccess("ticket-1", "Client@Example.com");
    expect(verifyTicketAccess("ticket-1", "client@example.com", sig)).toBe(true);
  });

  it("rejects invalid signatures", () => {
    const sig = signTicketAccess("ticket-1", "client@example.com");
    expect(verifyTicketAccess("ticket-1", "other@example.com", sig)).toBe(false);
    expect(verifyTicketAccess("ticket-2", "client@example.com", sig)).toBe(false);
  });

  it("builds reusable ticket access URLs", () => {
    const url = buildTicketAccessUrl("ticket-abc", "client@example.com");
    expect(url).toContain("https://corp-tickets.test/auth/ticket-access?");
    expect(url).toContain("ticket=ticket-abc");
    expect(url).toContain("sig=");
  });
});
