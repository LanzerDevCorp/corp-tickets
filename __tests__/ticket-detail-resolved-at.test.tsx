/**
 * Unit tests for resolved_at display in the TicketDetail component.
 *
 * TDD — RED phase: these tests are written BEFORE the Phase 3 implementation.
 *
 * Test matrix:
 *   (a) resolved_at: null  — the "Resuelto" label must NOT appear.
 *       State before Phase 3: PASSES (component does not render the row at all).
 *       This test guards the null-exclusion requirement and turns into a
 *       regression test once implementation is in place.
 *
 *   (b) resolved_at: set   — "Resuelto" label MUST appear with a formatted date.
 *       State before Phase 3: FAILS (RED) — component does not render the row.
 *       This is the driving test that forces the implementation.
 *
 * Run: npm test __tests__/ticket-detail-resolved-at.test.tsx
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server actions — all return no-ops for unit tests
vi.mock("@/app/actions/tickets", () => ({
  updateTicketStatus: vi.fn().mockResolvedValue({}),
  assignTicket: vi.fn().mockResolvedValue({}),
  updateTicketCategory: vi.fn().mockResolvedValue({}),
  markTicketAsSeen: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/app/actions/comments", () => ({
  addComment: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/app/actions/attachments", () => ({
  uploadAttachment: vi.fn().mockResolvedValue({}),
  deleteAttachment: vi.fn().mockResolvedValue({}),
  getAttachmentUrl: vi.fn().mockResolvedValue(""),
}));

// Mock Next.js Link — renders a plain anchor in jsdom
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

// Import AFTER mocks are registered
import TicketDetail from "@/components/dashboard/ticket-detail";

const baseTicket = {
  id: "ticket-test-resolved",
  subject: "Test Ticket for resolved_at",
  name: "Jane Doe",
  email: "jane@example.com",
  status: "open",
  priority: "medium",
  created_at: "2026-06-01T10:00:00Z",
  updated_at: "2026-06-20T12:00:00Z",
  body: "Test ticket body",
  category: { name: "General" },
  category_id: "cat-test-1",
  assigned_to: null,
  assignee: null,
  closure_reason: null,
  resolved_at: null,
  first_seen_at: null,
};

const defaultProps = {
  staffUsers: [],
  categories: [],
  initialComments: [],
  initialAttachments: [],
};

describe("TicketDetail — resolved_at display", () => {
  it("(a) does not render resolved_at info-summary row when resolved_at is null", () => {
    render(
      <TicketDetail
        initialTicket={{ ...baseTicket, resolved_at: null }}
        {...defaultProps}
      />,
    );

    // The info-summary label "Resuelto:" (with colon) must NOT appear.
    // "Resuelto" without colon is fine — it appears in the status badge/select.
    // This test guards the null-exclusion requirement from the spec.
    expect(screen.queryByText(/^Resuelto:$/)).not.toBeInTheDocument();
  });

  it("(b) renders resolved_at info-summary row with 'Resuelto:' label when resolved_at is set", () => {
    const resolvedTicket = {
      ...baseTicket,
      status: "resolved",
      resolved_at: "2026-06-25T14:00:00Z",
    };

    render(<TicketDetail initialTicket={resolvedTicket} {...defaultProps} />);

    // The info-summary label "Resuelto:" (with colon, following the "Creado:" pattern)
    // must appear when resolved_at is non-null.
    // RED before Phase 3: fails because the component does not render this row yet.
    expect(screen.getByText(/^Resuelto:$/)).toBeInTheDocument();
  });
});
