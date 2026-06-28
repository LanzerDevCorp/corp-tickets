import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// jsdom does not implement ResizeObserver or scrollIntoView — both are
// required by cmdk (powering the Shadcn Select) and MultiSelect.
if (typeof global.ResizeObserver === "undefined") {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

if (typeof window.HTMLElement.prototype.scrollIntoView === "undefined") {
  window.HTMLElement.prototype.scrollIntoView = function () {};
}

// ---------------------------------------------------------------------------
// Module mocks — declared before imports of the modules under test.
// ---------------------------------------------------------------------------

vi.mock("@/app/actions/tickets", () => ({
  getTickets: vi.fn().mockResolvedValue([]),
  markTicketAsSeen: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/hooks/use-ticket-queue-realtime", () => ({
  useTicketQueueRealtime: vi.fn(),
}));

// NewTicketHighlight mock: always renders so we can assert on isNew prop.
vi.mock("@/components/dashboard/ticket-new-animation", () => ({
  NewTicketHighlight: ({ isNew }: { isNew: boolean }) => (
    <div data-testid="new-ticket-highlight" data-is-new={String(isNew)} />
  ),
}));

// TicketSubjectPreview mock: renders a link that fires onSeen on mouseEnter.
vi.mock("@/components/dashboard/ticket-subject-preview", () => ({
  TicketSubjectPreview: ({
    ticket,
    onSeen,
  }: {
    ticket: { id: string; subject: string };
    onSeen?: () => void;
  }) => (
    <a
      href={`/dashboard/tickets/${ticket.id}`}
      data-testid={`preview-${ticket.id}`}
      onMouseEnter={onSeen}
    >
      {ticket.subject}
    </a>
  ),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks so vi.mock hoisting applies)
// ---------------------------------------------------------------------------

import TicketQueue from "@/components/dashboard/ticket-queue";
import { markTicketAsSeen, getTickets } from "@/app/actions/tickets";

const mockMarkSeen = vi.mocked(markTicketAsSeen);
const mockGetTickets = vi.mocked(getTickets);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_TICKET = {
  id: "ticket-abc",
  subject: "Printer is broken",
  body: "It won't print anything.",
  name: "Alice Smith",
  email: "alice@example.com",
  status: "open",
  priority: "medium",
  created_at: "2026-06-25T10:00:00Z",
  category: { name: "Hardware" },
  assignee: null,
};

const UNSEEN_TICKET = { ...BASE_TICKET, first_seen_at: null };
const SEEN_TICKET = { ...BASE_TICKET, id: "ticket-xyz", first_seen_at: "2026-06-25T11:00:00Z" };

const CATEGORIES = [{ id: "cat-1", name: "Hardware" }];
const STAFF_USERS: never[] = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type QueueTicket = Omit<typeof UNSEEN_TICKET, "first_seen_at"> & {
  first_seen_at: string | null;
};

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderQueue(tickets: QueueTicket[], queryClient = makeQueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <TicketQueue
        initialTickets={tickets as any}
        categories={CATEGORIES}
        staffUsers={STAFF_USERS}
      />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TicketQueue — realtime + new-ticket highlight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMarkSeen.mockResolvedValue(undefined);
  });

  it("renders NewTicketHighlight with isNew=true for a ticket with first_seen_at=null", () => {
    renderQueue([UNSEEN_TICKET]);

    const highlight = screen.getByTestId("new-ticket-highlight");
    expect(highlight).toHaveAttribute("data-is-new", "true");
  });

  it("renders NewTicketHighlight with isNew=false for a ticket with first_seen_at set", () => {
    renderQueue([SEEN_TICKET]);

    const highlight = screen.getByTestId("new-ticket-highlight");
    expect(highlight).toHaveAttribute("data-is-new", "false");
  });

  it("flips isNew to false optimistically when onSeen fires, and calls markTicketAsSeen", async () => {
    // Ensure the query resolves with the same ticket so initialTickets is not replaced by [].
    mockGetTickets.mockResolvedValue([UNSEEN_TICKET] as any);
    renderQueue([UNSEEN_TICKET]);

    // Initially unseen → isNew=true
    expect(screen.getByTestId("new-ticket-highlight")).toHaveAttribute("data-is-new", "true");

    // Simulate hover on the TicketSubjectPreview (which calls onSeen)
    await act(async () => {
      fireEvent.mouseEnter(screen.getByTestId(`preview-${UNSEEN_TICKET.id}`));
    });

    // Optimistic update: isNew should now be false (seenLocally has the id)
    expect(screen.getByTestId("new-ticket-highlight")).toHaveAttribute("data-is-new", "false");

    // Server action should have been called
    expect(mockMarkSeen).toHaveBeenCalledWith(UNSEEN_TICKET.id);
  });

  it("rolls back isNew to true when markTicketAsSeen rejects", async () => {
    // Ensure the query resolves with the same ticket so the row stays visible.
    mockGetTickets.mockResolvedValue([UNSEEN_TICKET] as any);
    mockMarkSeen.mockRejectedValueOnce(new Error("network error"));

    renderQueue([UNSEEN_TICKET]);

    expect(screen.getByTestId("new-ticket-highlight")).toHaveAttribute("data-is-new", "true");

    await act(async () => {
      fireEvent.mouseEnter(screen.getByTestId(`preview-${UNSEEN_TICKET.id}`));
    });

    // After rollback seenLocally no longer has the id → isNew restored
    expect(screen.getByTestId("new-ticket-highlight")).toHaveAttribute("data-is-new", "true");
  });
});
