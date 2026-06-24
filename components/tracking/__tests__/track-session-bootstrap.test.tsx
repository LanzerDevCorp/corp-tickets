import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

const mockReplace = vi.fn();
const mockRefresh = vi.fn();
let mockPathname = "/track/access";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, refresh: mockRefresh }),
  usePathname: () => mockPathname,
}));

vi.mock("@/lib/auth/establish-browser-session", () => ({
  establishBrowserSessionFromUrl: vi.fn().mockResolvedValue({ ok: false }),
}));

vi.mock("@/lib/tickets/reference", () => ({
  formatTicketReference: vi.fn((id: string) => id.slice(0, 8).toUpperCase()),
}));

import { TrackSessionBootstrap } from "../track-session-bootstrap";

describe("TrackSessionBootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/track/access";
    if (typeof window !== "undefined") {
      Object.defineProperty(window, "location", {
        value: { hash: "" },
        writable: true,
      });
    }
  });

  it("renders children immediately on /track/access without server session", () => {
    render(
      <TrackSessionBootstrap hasServerSession={false}>
        <div data-testid="child-content">Track Access Panel</div>
      </TrackSessionBootstrap>
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.queryByText(/verif/i)).not.toBeInTheDocument();
  });

  it("does NOT redirect to /track/access when already on /track/access", async () => {
    render(
      <TrackSessionBootstrap hasServerSession={false}>
        <div>form</div>
      </TrackSessionBootstrap>
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("renders children immediately on /track/access even with no hash", () => {
    render(
      <TrackSessionBootstrap hasServerSession={false}>
        <div data-testid="access-panel">panel</div>
      </TrackSessionBootstrap>
    );

    expect(screen.getByTestId("access-panel")).toBeInTheDocument();
  });

  it("redirects to /track/access with ref when session expires on ticket route", async () => {
    mockPathname = "/track/abc-ticket-id-here";

    render(
      <TrackSessionBootstrap hasServerSession={false}>
        <div>ticket content</div>
      </TrackSessionBootstrap>
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("/track/access")
    );
  });

  it("renders children immediately when server session is active", () => {
    render(
      <TrackSessionBootstrap hasServerSession={true}>
        <div data-testid="authenticated-child">ticket view</div>
      </TrackSessionBootstrap>
    );

    expect(screen.getByTestId("authenticated-child")).toBeInTheDocument();
  });
});
