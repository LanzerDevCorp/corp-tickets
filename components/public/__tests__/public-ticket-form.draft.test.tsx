/**
 * Integration tests for draft persistence in PublicTicketForm — Strict TDD (T-09)
 *
 * Tests the hook+component boundary: banner rendering, "Limpiar" state machine,
 * auto-clear on success, and localStorage interaction from the component's perspective.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Hoisted mock factories
// ---------------------------------------------------------------------------

const mockSubmitTicket = vi.hoisted(() => vi.fn());

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/app/actions/tickets", () => ({
  submitTicket: mockSubmitTicket,
}));

vi.mock("@/lib/turnstile/config", () => ({
  isTurnstileEnabled: () => false,
}));

vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: () => null,
}));

// Mock file upload orchestration — we don't test uploads here
vi.mock("../upload-orchestration", () => ({
  orchestrateFileUpload: vi.fn().mockResolvedValue({ error: null }),
}));

// ---------------------------------------------------------------------------
// Import SUT after mocks
// ---------------------------------------------------------------------------

import { PublicTicketForm } from "../public-ticket-form";
import { DRAFT_KEY } from "@/hooks/use-form-draft";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301", name: "Hardware" },
  { id: "3f2504e0-4f89-11d3-9a0c-0305e82c3302", name: "Software" },
];

const VALID_DRAFT = JSON.stringify({
  name: "Test User",
  email: "test@example.com",
  subject: "Test subject line",
  body: "This is a test body with enough characters.",
  priority: "medium",
  category_id: CATEGORIES[0].id,
});

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  // Default: submitTicket returns an unresolved initial state
  mockSubmitTicket.mockResolvedValue({ error: "no-submit" });
});

afterEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderForm(initialDraft: string | null = null) {
  if (initialDraft !== null) {
    localStorage.setItem(DRAFT_KEY, initialDraft);
  }
  return render(<PublicTicketForm categories={CATEGORIES} />);
}

// ---------------------------------------------------------------------------
// T-09 Scenario 1: Banner appears on mount when localStorage has valid draft
// ---------------------------------------------------------------------------
describe("Recovery banner", () => {
  it("appears when localStorage has a valid draft on mount", async () => {
    renderForm(VALID_DRAFT);

    await waitFor(() => {
      expect(screen.getByText("Borrador recuperado")).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it("is absent when no draft exists in localStorage", async () => {
    renderForm(null);

    // Let mount effects run
    await act(async () => {});

    expect(screen.queryByText("Borrador recuperado")).not.toBeInTheDocument();
  });

  // T-09 Scenario 6: Banner "Limpiar" link → opens same confirm state
  it("'Limpiar' link in banner opens confirm state", async () => {
    const user = userEvent.setup();
    renderForm(VALID_DRAFT);

    await waitFor(() => {
      expect(screen.getByText("Borrador recuperado")).toBeInTheDocument();
    }, { timeout: 3000 });

    // The banner has a "Limpiar" button
    const bannerLimpiar = screen.getAllByRole("button", { name: /limpiar/i })[0];
    await user.click(bannerLimpiar);

    // Confirm state must appear
    await waitFor(() => {
      expect(screen.getByText(/limpiar todo/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /confirmar/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /cancelar/i })).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// T-09 Scenario 3: "Limpiar" button in action row → shows confirm state
// ---------------------------------------------------------------------------
describe("'Limpiar' action row button", () => {
  it("shows confirm state when clicked", async () => {
    const user = userEvent.setup();
    renderForm(null);

    await act(async () => {});

    const limpiarBtn = screen.getByRole("button", { name: /^limpiar$/i });
    await user.click(limpiarBtn);

    expect(screen.getByText(/limpiar todo/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirmar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancelar/i })).toBeInTheDocument();
  });

  it("confirmation message mentions attachments", async () => {
    const user = userEvent.setup();
    renderForm(null);

    await act(async () => {});

    await user.click(screen.getByRole("button", { name: /^limpiar$/i }));

    expect(screen.getByText(/archivos también se perderán/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// T-09 Scenario 5: Cancel clear → form state unchanged, button returns to "Limpiar"
// ---------------------------------------------------------------------------
describe("Cancel clear", () => {
  it("returns to 'Limpiar' label without changing form state", async () => {
    const user = userEvent.setup();
    renderForm(VALID_DRAFT);

    await waitFor(() => {
      expect(screen.getByText("Borrador recuperado")).toBeInTheDocument();
    }, { timeout: 3000 });

    // Two "Limpiar" buttons exist: one in the banner, one in the action row.
    // Use getAllByRole and pick the action-row one (last in DOM order).
    const limpiarBtns = screen.getAllByRole("button", { name: /^limpiar$/i });
    await user.click(limpiarBtns[limpiarBtns.length - 1]);

    expect(screen.getByRole("button", { name: /confirmar/i })).toBeInTheDocument();

    // Click cancel
    await user.click(screen.getByRole("button", { name: /cancelar/i }));

    // Confirm state gone, "Limpiar" buttons are back
    await waitFor(() => {
      expect(screen.queryByText(/limpiar todo/i)).not.toBeInTheDocument();
      // At least one "Limpiar" button visible (action row, possibly banner too)
      expect(screen.getAllByRole("button", { name: /^limpiar$/i }).length).toBeGreaterThan(0);
    });

    // Banner still visible (draft not cleared)
    expect(screen.getByText("Borrador recuperado")).toBeInTheDocument();
    expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// T-09 Scenario 4: Confirm clear → removes localStorage key, clears banner
// ---------------------------------------------------------------------------
describe("Confirm clear", () => {
  it("removes localStorage key and dismisses banner on confirm", async () => {
    const user = userEvent.setup();
    renderForm(VALID_DRAFT);

    await waitFor(() => {
      expect(screen.getByText("Borrador recuperado")).toBeInTheDocument();
    }, { timeout: 3000 });

    // Use the action-row "Limpiar" (last of the two buttons)
    const limpiarBtns = screen.getAllByRole("button", { name: /^limpiar$/i });
    await user.click(limpiarBtns[limpiarBtns.length - 1]);
    await user.click(screen.getByRole("button", { name: /confirmar/i }));

    await waitFor(() => {
      expect(screen.queryByText("Borrador recuperado")).not.toBeInTheDocument();
    }, { timeout: 3000 });

    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("resets form fields to default values on confirm", async () => {
    const user = userEvent.setup();
    renderForm(VALID_DRAFT);

    await waitFor(() => {
      expect(screen.getByText("Borrador recuperado")).toBeInTheDocument();
    }, { timeout: 3000 });

    // Verify draft values are loaded
    await waitFor(() => {
      const nameInput = screen.getByPlaceholderText("Tu nombre completo") as HTMLInputElement;
      expect(nameInput.value).toBe("Test User");
    }, { timeout: 3000 });

    // Confirm clear via action-row "Limpiar"
    const limpiarBtns = screen.getAllByRole("button", { name: /^limpiar$/i });
    await user.click(limpiarBtns[limpiarBtns.length - 1]);
    await user.click(screen.getByRole("button", { name: /confirmar/i }));

    // Name field should be reset to ""
    await waitFor(() => {
      const nameInput = screen.getByPlaceholderText("Tu nombre completo") as HTMLInputElement;
      expect(nameInput.value).toBe("");
    }, { timeout: 3000 });
  });
});
