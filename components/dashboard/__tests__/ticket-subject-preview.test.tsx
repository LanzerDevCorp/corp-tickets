import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TicketSubjectPreview } from "../ticket-subject-preview";

// TicketSubjectPreview uses createPortal to render the preview card into
// document.body. jsdom supports this out of the box.

const TEST_TICKET = {
  id: "ticket-preview-1",
  subject: "Laptop won't start",
  body: "Hasn't turned on since this morning.",
  name: "Diana Prince",
  email: "diana@example.com",
  created_at: "2026-06-25T09:00:00Z",
};

afterEach(() => {
  vi.restoreAllMocks();
});

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
