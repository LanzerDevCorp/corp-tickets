import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Module mocks — must be declared before the component import.
// ---------------------------------------------------------------------------

vi.mock("@/app/actions/tickets", () => ({
  markTicketAsSeen: vi.fn().mockResolvedValue(undefined),
  updateTicketStatus: vi.fn(),
  assignTicket: vi.fn(),
  updateTicketCategory: vi.fn(),
}));

// Suppress heavy sub-components that are irrelevant to this test.
vi.mock("@/components/dashboard/comment-thread", () => ({
  default: () => null,
}));
vi.mock("@/components/dashboard/comment-form", () => ({
  default: () => null,
}));
vi.mock("@/components/dashboard/attachment-manager", () => ({
  default: () => null,
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import TicketDetail from "@/components/dashboard/ticket-detail";
import { markTicketAsSeen } from "@/app/actions/tickets";

const mockMarkSeen = vi.mocked(markTicketAsSeen);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTicket(id: string) {
  return {
    id,
    subject: "Test ticket",
    body: "Test body",
    name: "Alice",
    email: "alice@example.com",
    status: "open",
    priority: "medium",
    created_at: "2026-06-25T10:00:00Z",
    category: { name: "Hardware" },
    category_id: "cat-1",
    assigned_to: null,
    assignee: null,
    closure_reason: null,
    first_seen_at: null,
  };
}

const BASE_PROPS = {
  staffUsers: [],
  categories: [{ id: "cat-1", name: "Hardware" }],
  initialComments: [],
  initialAttachments: [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TicketDetail — markTicketAsSeen mount effect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMarkSeen.mockResolvedValue(undefined);
  });

  it("calls markTicketAsSeen with ticket.id on initial mount", async () => {
    render(<TicketDetail initialTicket={makeTicket("ticket-001")} {...BASE_PROPS} />);

    // Allow the useEffect microtask to flush.
    await vi.waitFor(() => {
      expect(mockMarkSeen).toHaveBeenCalledTimes(1);
      expect(mockMarkSeen).toHaveBeenCalledWith("ticket-001");
    });
  });

  it("calls markTicketAsSeen again when the ticket id changes (remount with new ticket)", async () => {
    const { rerender } = render(
      <TicketDetail initialTicket={makeTicket("ticket-001")} {...BASE_PROPS} />,
    );

    await vi.waitFor(() => expect(mockMarkSeen).toHaveBeenCalledTimes(1));

    rerender(<TicketDetail initialTicket={makeTicket("ticket-002")} {...BASE_PROPS} />);

    await vi.waitFor(() => {
      expect(mockMarkSeen).toHaveBeenCalledTimes(2);
      expect(mockMarkSeen).toHaveBeenNthCalledWith(2, "ticket-002");
    });
  });
});
