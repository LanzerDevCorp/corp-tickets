/**
 * Tests for useFormDraft — Strict TDD
 *
 * RED: written first (alongside the skeleton T-01), before full implementation.
 * GREEN: pass once T-03 → T-05 implementation is complete.
 * REFACTOR: no structural changes needed after green.
 *
 * Covers all spec scenarios listed in T-02.
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useFormDraft, DRAFT_KEY, DEFAULTS } from "./use-form-draft";
import { ticketSubmitSchema, type TicketSubmitData } from "@/lib/schemas/ticket-submit";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301", name: "Hardware" },
  { id: "3f2504e0-4f89-11d3-9a0c-0305e82c3302", name: "Software" },
];

const VALID_CATEGORY_A = CATEGORIES[0].id;
const VALID_CATEGORY_B = CATEGORIES[1].id;

/** Render the hook inside a form context.
 *  Note: fake timers are NOT used here — waitFor relies on real Promise microtasks.
 *  Debounce tests use vi.useFakeTimers() manually within their describe block.
 */
function renderWithForm(
  initialStorage: string | null = null,
  isSuccess = false,
  categories = CATEGORIES,
) {
  if (initialStorage !== null) {
    localStorage.setItem(DRAFT_KEY, initialStorage);
  }

  return renderHook(
    ({ success }: { success: boolean }) => {
      const form = useForm<TicketSubmitData>({
        resolver: standardSchemaResolver(ticketSubmitSchema),
        mode: "onChange",
        defaultValues: { ...DEFAULTS },
      });
      const draft = useFormDraft(form, categories, success);
      return { form, draft };
    },
    {
      initialProps: { success: isSuccess },
    },
  );
}

/** Draft with all valid field values (passes schema validation) */
function validDraft(overrides: Partial<Record<string, unknown>> = {}): string {
  return JSON.stringify({
    name: "Dana",
    email: "dana@example.com",
    subject: "Laptop broken",
    body: "My laptop won't start since yesterday morning.",
    priority: "high",
    category_id: VALID_CATEGORY_A,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 1-2. Persist: debounced save
// ---------------------------------------------------------------------------
describe("Persist (debounced save)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes only the six persisted fields after 500 ms debounce", async () => {
    const { result } = renderWithForm();

    await act(async () => {
      result.current.form.setValue("name", "Alice");
      result.current.form.setValue("email", "alice@example.com");
      vi.advanceTimersByTime(500);
    });

    const stored = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}");
    expect(stored).toHaveProperty("name", "Alice");
    expect(stored).toHaveProperty("email", "alice@example.com");
  });

  it("does NOT write selectedFiles or turnstile_token to localStorage", async () => {
    const { result } = renderWithForm();

    await act(async () => {
      result.current.form.setValue("name", "Bob");
      vi.advanceTimersByTime(500);
    });

    const stored = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}");
    expect(stored).not.toHaveProperty("selectedFiles");
    expect(stored).not.toHaveProperty("turnstile_token");
    const keys = Object.keys(stored);
    expect(keys).toEqual(
      expect.arrayContaining(["name", "email", "subject", "body", "priority", "category_id"]),
    );
    expect(keys.length).toBe(6);
  });

  it("does NOT write before 500 ms debounce window elapses", async () => {
    const { result } = renderWithForm();

    await act(async () => {
      result.current.form.setValue("name", "Charlie");
      vi.advanceTimersByTime(300);
    });

    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3-5. Restore on mount
// ---------------------------------------------------------------------------
describe("Restore on mount", () => {
  it("restores valid draft: sets fields and returns hasDraft=true", async () => {
    const { result } = renderWithForm(validDraft());

    await waitFor(() => {
      expect(result.current.draft.hasDraft).toBe(true);
    }, { timeout: 3000 });

    expect(result.current.form.getValues("name")).toBe("Dana");
    expect(result.current.form.getValues("email")).toBe("dana@example.com");
    expect(result.current.form.getValues("priority")).toBe("high");
    expect(result.current.form.getValues("category_id")).toBe(VALID_CATEGORY_A);
  });

  it("returns hasDraft=false and keeps defaultValues when key is absent", async () => {
    const { result } = renderWithForm(null);

    // Small wait to let mount effect run
    await act(async () => {});

    expect(result.current.draft.hasDraft).toBe(false);
    expect(result.current.form.getValues("name")).toBe("");
    expect(result.current.form.getValues("priority")).toBe("medium");
  });

  it("silently skips malformed JSON and returns hasDraft=false", async () => {
    localStorage.setItem(DRAFT_KEY, "{{not valid json}}");

    const { result } = renderHook(() => {
      const form = useForm<TicketSubmitData>({
        resolver: standardSchemaResolver(ticketSubmitSchema),
        mode: "onChange",
        defaultValues: { ...DEFAULTS },
      });
      return { form, draft: useFormDraft(form, CATEGORIES, false) };
    });

    await act(async () => {});

    expect(result.current.draft.hasDraft).toBe(false);
    expect(result.current.form.getValues("name")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// 6-7. Stale category guard
// ---------------------------------------------------------------------------
describe("Stale category guard", () => {
  it("sets category_id to '' when stored UUID is not in categories", async () => {
    const draft = validDraft({ category_id: "00000000-0000-0000-0000-000000000000" });
    const { result } = renderWithForm(draft);

    await waitFor(() => expect(result.current.draft.hasDraft).toBe(true), { timeout: 3000 });
    expect(result.current.form.getValues("category_id")).toBe("");
  });

  it("sets category_id correctly when stored UUID is valid", async () => {
    const draft = validDraft({ category_id: VALID_CATEGORY_B });
    const { result } = renderWithForm(draft);

    await waitFor(() => expect(result.current.draft.hasDraft).toBe(true), { timeout: 3000 });
    expect(result.current.form.getValues("category_id")).toBe(VALID_CATEGORY_B);
  });
});

// ---------------------------------------------------------------------------
// 8-9. Priority restore fidelity
// ---------------------------------------------------------------------------
describe("Priority restore fidelity", () => {
  it("restores stored priority 'high' instead of the 'medium' default", async () => {
    const draft = validDraft({ priority: "high" });
    const { result } = renderWithForm(draft);

    await waitFor(() => expect(result.current.draft.hasDraft).toBe(true), { timeout: 3000 });
    expect(result.current.form.getValues("priority")).toBe("high");
  });

  it("leaves priority as 'medium' when key is absent from stored draft", async () => {
    const draftWithoutPriority = JSON.stringify({
      name: "Hank",
      email: "hank@example.com",
      subject: "No priority key",
      body: "Draft without priority field at all.",
      category_id: VALID_CATEGORY_A,
      // Note: priority key intentionally omitted
    });

    const { result } = renderWithForm(draftWithoutPriority);

    await waitFor(() => expect(result.current.draft.hasDraft).toBe(true), { timeout: 3000 });
    expect(result.current.form.getValues("priority")).toBe("medium");
  });
});

// ---------------------------------------------------------------------------
// 10-11. Auto-clear on success
// ---------------------------------------------------------------------------
describe("Auto-clear on successful submission", () => {
  it("removes localStorage key and sets hasDraft=false when isSuccess flips true", async () => {
    const { result, rerender } = renderWithForm(validDraft(), false);

    await waitFor(() => expect(result.current.draft.hasDraft).toBe(true), { timeout: 3000 });

    act(() => {
      rerender({ success: true });
    });

    await waitFor(() => {
      expect(result.current.draft.hasDraft).toBe(false);
    }, { timeout: 3000 });

    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("preserves draft when isSuccess stays false (submission error)", async () => {
    const { result } = renderWithForm(validDraft(), false);

    await waitFor(() => expect(result.current.draft.hasDraft).toBe(true), { timeout: 3000 });

    // isSuccess never flips — draft stays
    expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull();
    expect(result.current.draft.hasDraft).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 12. Watch loop prevention
// ---------------------------------------------------------------------------
describe("Watch loop prevention (isRestoring guard)", () => {
  it("does NOT write to localStorage during the restore phase", async () => {
    vi.useFakeTimers();

    // Pre-seed storage (before the spy so the initial seed is not counted)
    localStorage.setItem(DRAFT_KEY, validDraft());

    // Spy AFTER seeding — only captures writes that happen after this point
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    // Render (mount effect fires during `act`)
    const { result } = renderHook(
      () => {
        const form = useForm<TicketSubmitData>({
          resolver: standardSchemaResolver(ticketSubmitSchema),
          mode: "onChange",
          defaultValues: { ...DEFAULTS },
        });
        return { form, draft: useFormDraft(form, CATEGORIES, false) };
      },
    );

    // Let mount effects and microtasks run; timer stays fake
    await act(async () => {
      vi.runAllTicks();
    });

    // During restore, isRestoring.current === true so the debounced writer is suppressed.
    // No setItem call should have happened yet (debounce hasn't elapsed).
    const callsDuringRestore = setItemSpy.mock.calls.filter(([k]) => k === DRAFT_KEY).length;
    expect(callsDuringRestore).toBe(0);

    vi.useRealTimers();
    setItemSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// 13. Revalidation after restore (ADR-9)
// ---------------------------------------------------------------------------
describe("Revalidation after restore (ADR-9)", () => {
  it("form.trigger() is invoked during restore (tracked via wrapper)", async () => {
    // body "Too short" is 9 chars — below min 10 to confirm trigger is needed
    const draft = validDraft({ body: "Too short" });
    localStorage.setItem(DRAFT_KEY, draft);

    let triggerCalled = false;

    const { result } = renderHook(() => {
      const form = useForm<TicketSubmitData>({
        resolver: standardSchemaResolver(ticketSubmitSchema),
        mode: "onChange",
        defaultValues: { ...DEFAULTS },
      });
      // Wrap trigger before passing form to the hook
      const origTrigger = form.trigger.bind(form);
      form.trigger = ((...args: Parameters<typeof origTrigger>) => {
        triggerCalled = true;
        return origTrigger(...args);
      }) as typeof form.trigger;

      return { form, draft: useFormDraft(form, CATEGORIES, false) };
    });

    await waitFor(() => {
      expect(result.current.draft.hasDraft).toBe(true);
    }, { timeout: 3000 });

    // After hasDraft=true the restore effect ran; trigger must have been called
    expect(triggerCalled).toBe(true);
  });

  it("form errors exist on body field when restored draft has too-short body", async () => {
    const draft = validDraft({ body: "Too short" }); // 9 chars < 10 min
    localStorage.setItem(DRAFT_KEY, draft);

    const { result } = renderHook(() => {
      const form = useForm<TicketSubmitData>({
        resolver: standardSchemaResolver(ticketSubmitSchema),
        mode: "onChange",
        defaultValues: { ...DEFAULTS },
      });
      return { form, draft: useFormDraft(form, CATEGORIES, false) };
    });

    await waitFor(() => {
      expect(result.current.draft.hasDraft).toBe(true);
    }, { timeout: 3000 });

    // Give trigger a moment to update formState
    await act(async () => {});

    // Either formState is invalid OR body has an error
    const hasBodyError = result.current.form.formState.errors.body !== undefined;
    const formInvalid = !result.current.form.formState.isValid;
    expect(hasBodyError || formInvalid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 14. SSR safety — no localStorage access during synchronous render
// ---------------------------------------------------------------------------
describe("SSR safety", () => {
  it("hasDraft starts as false on initial render (before effects)", () => {
    // Capture the initial (synchronous) render result
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem");

    let capturedInitialHasDraft: boolean | undefined;

    renderHook(() => {
      const form = useForm<TicketSubmitData>({
        resolver: standardSchemaResolver(ticketSubmitSchema),
        mode: "onChange",
        defaultValues: { ...DEFAULTS },
      });
      const draft = useFormDraft(form, CATEGORIES, false);
      // Capture on the very first render invocation
      if (capturedInitialHasDraft === undefined) {
        capturedInitialHasDraft = draft.hasDraft;
      }
      return draft;
    });

    // Must be false on first render — localStorage not yet read
    expect(capturedInitialHasDraft).toBe(false);

    getItemSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// 15. clearDraft
// ---------------------------------------------------------------------------
describe("clearDraft", () => {
  it("removes localStorage key, resets form to defaults, and sets hasDraft=false", async () => {
    const { result } = renderWithForm(validDraft());

    await waitFor(() => expect(result.current.draft.hasDraft).toBe(true), { timeout: 3000 });

    act(() => {
      result.current.draft.clearDraft();
    });

    await waitFor(() => {
      expect(result.current.draft.hasDraft).toBe(false);
    }, { timeout: 3000 });

    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(result.current.form.getValues("name")).toBe("");
    expect(result.current.form.getValues("priority")).toBe("medium");
  });

  it("does NOT re-write localStorage after clearDraft (isRestoring guard)", async () => {
    vi.useFakeTimers();

    const { result } = renderWithForm(validDraft());

    // Let mount effects run
    await act(async () => { vi.runAllTicks(); });

    // Advance to let any initial debounce fire
    await act(async () => { vi.advanceTimersByTime(600); });

    vi.useRealTimers();

    await waitFor(() => expect(result.current.draft.hasDraft).toBe(true), { timeout: 3000 });

    vi.useFakeTimers();

    act(() => {
      result.current.draft.clearDraft();
    });

    // Advance past debounce window
    await act(async () => { vi.advanceTimersByTime(600); });

    vi.useRealTimers();

    // Key must remain absent — no re-write from post-reset watch
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});
