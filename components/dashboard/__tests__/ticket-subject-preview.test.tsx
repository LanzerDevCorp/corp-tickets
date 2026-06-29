import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Module mocks — declared before component imports so vi.mock hoisting applies.
// ---------------------------------------------------------------------------

// Prevent supabaseAdmin (a server-only module) from being evaluated in jsdom.
// ticket-subject-preview.tsx imports updateTicketStatus → app/actions/tickets
// → lib/supabase/admin, which throws when typeof window !== "undefined".
vi.mock("@/app/actions/tickets", () => ({
  updateTicketStatus: vi.fn().mockResolvedValue(undefined),
  getTickets: vi.fn().mockResolvedValue([]),
  markTicketAsSeen: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { TicketSubjectPreview } from "../ticket-subject-preview";
import { updateTicketStatus } from "@/app/actions/tickets";

// TicketSubjectPreview uses createPortal to render the preview card into
// document.body. jsdom supports this out of the box.

const mockUpdateStatus = vi.mocked(updateTicketStatus);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TEST_TICKET = {
  id: "ticket-preview-1",
  subject: "Laptop won't start",
  body: "Hasn't turned on since this morning.",
  name: "Diana Prince",
  email: "diana@example.com",
  created_at: "2026-06-25T09:00:00Z",
  status: "open",
};

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateStatus.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests — onSeen prop (existing)
// ---------------------------------------------------------------------------

describe("TicketSubjectPreview — onSeen prop", () => {
  it("calls onSeen when showPreview fires (mouseEnter on the link)", () => {
    const onSeen = vi.fn();

    render(<TicketSubjectPreview ticket={TEST_TICKET} onSeen={onSeen} />);

    const link = screen.getByRole("link", { name: TEST_TICKET.subject });
    fireEvent.mouseEnter(link);

    expect(onSeen).toHaveBeenCalledTimes(1);
  });

  it("calls onSeen when showPreview fires via focus on the link", () => {
    const onSeen = vi.fn();

    render(<TicketSubjectPreview ticket={TEST_TICKET} onSeen={onSeen} />);

    const link = screen.getByRole("link", { name: TEST_TICKET.subject });
    fireEvent.focus(link);

    expect(onSeen).toHaveBeenCalledTimes(1);
  });

  it("does not throw when onSeen is not provided and mouseEnter fires", () => {
    render(<TicketSubjectPreview ticket={TEST_TICKET} />);

    const link = screen.getByRole("link", { name: TEST_TICKET.subject });

    expect(() => fireEvent.mouseEnter(link)).not.toThrow();
  });

  it("does not throw when onSeen is not provided and focus fires", () => {
    render(<TicketSubjectPreview ticket={TEST_TICKET} />);

    const link = screen.getByRole("link", { name: TEST_TICKET.subject });

    expect(() => fireEvent.focus(link)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Tests — resolve button (new behavior)
// ---------------------------------------------------------------------------

describe("TicketSubjectPreview — resolve button", () => {
  it("renders 'Mark as resolved' button when ticket status is open", async () => {
    const user = userEvent.setup();
    render(
      <TicketSubjectPreview ticket={{ ...TEST_TICKET, status: "open" }} />,
    );

    const link = screen.getByRole("link", { name: TEST_TICKET.subject });
    await user.hover(link);

    expect(
      await screen.findByRole("button", { name: /resuelto/i }),
    ).toBeInTheDocument();
  });

  it("does not render the resolve button when ticket status is 'resolved'", async () => {
    const user = userEvent.setup();
    render(
      <TicketSubjectPreview ticket={{ ...TEST_TICKET, status: "resolved" }} />,
    );

    const link = screen.getByRole("link", { name: TEST_TICKET.subject });
    await user.hover(link);

    // Wait for the card to actually open before checking the button is absent.
    await screen.findByText(/submitted a new ticket/i);
    expect(
      screen.queryByRole("button", { name: /mark as resolved/i }),
    ).not.toBeInTheDocument();
  });

  it("does not render the resolve button when ticket status is 'closed'", async () => {
    const user = userEvent.setup();
    render(
      <TicketSubjectPreview ticket={{ ...TEST_TICKET, status: "closed" }} />,
    );

    const link = screen.getByRole("link", { name: TEST_TICKET.subject });
    await user.hover(link);

    await screen.findByText(/submitted a new ticket/i);
    expect(
      screen.queryByRole("button", { name: /mark as resolved/i }),
    ).not.toBeInTheDocument();
  });

  it("calls updateTicketStatus with 'resolved' and then fires onResolved", async () => {
    const user = userEvent.setup();
    const onResolved = vi.fn();

    render(
      <TicketSubjectPreview
        ticket={{ ...TEST_TICKET, status: "open" }}
        onResolved={onResolved}
      />,
    );

    const link = screen.getByRole("link", { name: TEST_TICKET.subject });
    await user.hover(link);

    const button = await screen.findByRole("button", {
      name: /resuelto/i,
    });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(mockUpdateStatus).toHaveBeenCalledWith(TEST_TICKET.id, "resolved");
    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1));
  });
});
