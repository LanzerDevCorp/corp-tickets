import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AttachmentManager from "../attachment-manager";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        uploadToSignedUrl: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  })),
}));

vi.mock("@/app/actions/attachments", () => ({
  createStaffUploadUrls: vi.fn(),
  registerStaffAttachments: vi.fn(),
  softDeleteAttachment: vi.fn(),
  restoreAttachment: vi.fn(),
  getTicketAttachments: vi.fn(),
}));

import {
  softDeleteAttachment,
  restoreAttachment,
  getTicketAttachments,
} from "@/app/actions/attachments";

describe("AttachmentManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders upload control", () => {
    render(<AttachmentManager ticketId="ticket-1" initialAttachments={[]} />);

    expect(
      screen.getByRole("button", { name: /subir archivos/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/seleccionar archivos adjuntos/i),
    ).toBeInTheDocument();
  });

  it("renders Eliminar on active attachments", () => {
    render(
      <AttachmentManager
        ticketId="ticket-1"
        initialAttachments={[
          {
            id: "att-1",
            filename: "reporte.pdf",
            size_bytes: 1024,
            url: "https://signed.url/reporte.pdf",
            expired: false,
          },
        ]}
      />,
    );

    expect(screen.getByText("reporte.pdf")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /eliminar/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /descargar/i })).toHaveAttribute(
      "href",
      "https://signed.url/reporte.pdf",
    );
  });

  it("renders greyed admin-removed attachment with Restaurar", async () => {
    const user = userEvent.setup();
    vi.mocked(restoreAttachment).mockResolvedValue({ error: null });
    vi.mocked(getTicketAttachments).mockResolvedValue([
      {
        id: "att-2",
        filename: "borrado.pdf",
        size_bytes: 512,
        url: null,
        expired: false,
        removedByAdmin: true,
      },
    ]);

    render(
      <AttachmentManager
        ticketId="ticket-1"
        initialAttachments={[
          {
            id: "att-2",
            filename: "borrado.pdf",
            size_bytes: 512,
            url: null,
            expired: false,
            removedByAdmin: true,
          },
        ]}
      />,
    );

    expect(screen.getByText("borrado.pdf")).toBeInTheDocument();
    expect(screen.getByText("Eliminado")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();

    const restoreButton = screen.getByRole("button", { name: /restaurar/i });
    await user.click(restoreButton);

    expect(restoreAttachment).toHaveBeenCalledWith("att-2");
  });

  it("calls softDeleteAttachment when Eliminar is clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(softDeleteAttachment).mockResolvedValue({ error: null });
    vi.mocked(getTicketAttachments).mockResolvedValue([]);

    render(
      <AttachmentManager
        ticketId="ticket-1"
        initialAttachments={[
          {
            id: "att-3",
            filename: "activo.pdf",
            size_bytes: 2048,
            url: "https://signed.url/activo.pdf",
            expired: false,
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /eliminar/i }));

    expect(softDeleteAttachment).toHaveBeenCalledWith("att-3");
  });
});
