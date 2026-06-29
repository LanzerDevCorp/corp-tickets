import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/app/actions/comments", () => ({
  addComment: vi.fn(),
}));

import ClientTicketView from "../client-ticket-view";

const baseTicket = {
  id: "11111111-1111-1111-1111-111111111111",
  subject: "Mi solicitud",
  body: "Descripción del problema",
  status: "open",
  priority: "medium",
  created_at: new Date("2026-06-29T12:00:00Z").toISOString(),
};

describe("ClientTicketView back link", () => {
  it("renders a 'Volver a mis tickets' link pointing to /track", () => {
    render(
      <ClientTicketView initialTicket={baseTicket} initialComments={[]} />,
    );

    const backLink = screen.getByRole("link", {
      name: /volver a mis tickets/i,
    });
    expect(backLink).toHaveAttribute("href", "/track");
  });
});
