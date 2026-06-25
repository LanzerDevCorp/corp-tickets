import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NewTicketHighlight } from "../ticket-new-animation";

// Reset any matchMedia override after each test.
afterEach(() => {
  vi.restoreAllMocks();
  // @ts-ignore — remove the property so jsdom reverts to its default (undefined)
  delete window.matchMedia;
});

// Helper to mock window.matchMedia for reduced-motion tests.
function mockMatchMedia(prefersReduced: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches:
        prefersReduced && query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("NewTicketHighlight", () => {
  it("renders the overlay element when isNew=true", () => {
    // No matchMedia in jsdom → useReducedMotion defaults to false → animated class.
    render(<NewTicketHighlight isNew={true} />);

    expect(screen.getByTestId("new-ticket-overlay")).toBeInTheDocument();
  });

  it("renders nothing (null) when isNew=false", () => {
    const { container } = render(<NewTicketHighlight isNew={false} />);

    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("new-ticket-overlay")).not.toBeInTheDocument();
  });

  it("applies animated class when motion is allowed", () => {
    mockMatchMedia(false); // prefers-reduced-motion: no-preference

    render(<NewTicketHighlight isNew={true} />);

    const overlay = screen.getByTestId("new-ticket-overlay");
    expect(overlay).toHaveClass("new-ticket-animated");
    expect(overlay).not.toHaveClass("new-ticket-static");
  });

  it("applies static-ring class (no animated class) when prefers-reduced-motion: reduce", () => {
    mockMatchMedia(true); // prefers-reduced-motion: reduce

    render(<NewTicketHighlight isNew={true} />);

    const overlay = screen.getByTestId("new-ticket-overlay");
    expect(overlay).toHaveClass("new-ticket-static");
    expect(overlay).not.toHaveClass("new-ticket-animated");
  });
});
