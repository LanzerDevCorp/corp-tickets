import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ClientTicketList from "../client-ticket-list";
import type { ClientTicketListItem } from "@/app/actions/client-tickets";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("ClientTicketList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state with link to public form", () => {
    render(<ClientTicketList tickets={[]} />);

    expect(screen.getByText("Aún no tienes tickets")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Crear ticket" });
    expect(link).toHaveAttribute("href", "/");
  });

  it("renders ticket rows with links to detail", () => {
    const tickets: ClientTicketListItem[] = [
      {
        id: "ticket-abc",
        subject: "Problema con acceso",
        status: "open",
        created_at: "2026-06-01T10:00:00Z",
        hasNewActivity: false,
      },
    ];

    render(<ClientTicketList tickets={tickets} />);

    const link = screen.getByRole("link", { name: /Problema con acceso/i });
    expect(link).toHaveAttribute("href", "/track/ticket-abc");
    expect(screen.getByText("Abierto")).toBeInTheDocument();
  });

  it("shows activity indicator when hasNewActivity is true", () => {
    const tickets: ClientTicketListItem[] = [
      {
        id: "ticket-1",
        subject: "Ticket con novedades",
        status: "in_progress",
        created_at: "2026-06-01T10:00:00Z",
        hasNewActivity: true,
      },
    ];

    render(<ClientTicketList tickets={tickets} />);

    expect(screen.getByLabelText("Actividad nueva")).toBeInTheDocument();
  });

  it("does not show activity indicator when hasNewActivity is false", () => {
    const tickets: ClientTicketListItem[] = [
      {
        id: "ticket-1",
        subject: "Ticket al día",
        status: "open",
        created_at: "2026-06-01T10:00:00Z",
        hasNewActivity: false,
      },
    ];

    render(<ClientTicketList tickets={tickets} />);

    expect(screen.queryByLabelText("Actividad nueva")).not.toBeInTheDocument();
  });
});
