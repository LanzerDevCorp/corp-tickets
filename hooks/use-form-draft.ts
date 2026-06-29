"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { TicketSubmitData } from "@/lib/schemas/ticket-submit";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DRAFT_KEY = "ticket-form-draft";

export const PERSISTED_FIELDS = [
  "name",
  "email",
  "subject",
  "body",
  "priority",
  "category_id",
] as const satisfies ReadonlyArray<keyof DraftPayload>;

export const DEFAULTS: DraftPayload = {
  name: "",
  email: "",
  subject: "",
  body: "",
  priority: "medium",
  category_id: "",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DraftPayload = Pick<
  TicketSubmitData,
  "name" | "email" | "subject" | "body" | "priority" | "category_id"
>;

export interface UseFormDraftReturn {
  hasDraft: boolean;
  clearDraft: () => void;
}

type Category = { id: string; name?: string };

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFormDraft(
  form: UseFormReturn<TicketSubmitData>,
  categories: Category[],
  isSuccess: boolean,
): UseFormDraftReturn {
  const [hasDraft, setHasDraft] = useState(false);
  const isRestoring = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------------------
  // Flow 1 — Restore on mount (SSR-safe: effect runs only client-side)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;

    let payload: Partial<DraftPayload>;
    try {
      payload = JSON.parse(raw) as Partial<DraftPayload>;
    } catch {
      // Malformed JSON — silent skip
      return;
    }

    isRestoring.current = true;

    const categoryIds = categories.map((c) => c.id);

    // Restore each persisted field with shouldValidate:false to batch trigger later
    if ("name" in payload && payload.name !== undefined) {
      form.setValue("name", payload.name, {
        shouldDirty: false,
        shouldValidate: false,
      });
    }
    if ("email" in payload && payload.email !== undefined) {
      form.setValue("email", payload.email, {
        shouldDirty: false,
        shouldValidate: false,
      });
    }
    if ("subject" in payload && payload.subject !== undefined) {
      form.setValue("subject", payload.subject, {
        shouldDirty: false,
        shouldValidate: false,
      });
    }
    if ("body" in payload && payload.body !== undefined) {
      form.setValue("body", payload.body, {
        shouldDirty: false,
        shouldValidate: false,
      });
    }
    // Priority: only set when key is explicitly present in payload
    if ("priority" in payload && payload.priority !== undefined) {
      form.setValue("priority", payload.priority, {
        shouldDirty: false,
        shouldValidate: false,
      });
    }
    // Stale-category guard: fall back to "" if stored UUID not in current list
    if ("category_id" in payload && payload.category_id !== undefined) {
      const validId = categoryIds.includes(payload.category_id)
        ? payload.category_id
        : "";
      form.setValue("category_id", validId, {
        shouldDirty: false,
        shouldValidate: false,
      });
    }

    // Batch revalidation after all setValue calls (ADR-9)
    form.trigger().then(() => {
      isRestoring.current = false;
    });

    setHasDraft(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — mount only

  // ---------------------------------------------------------------------------
  // Flow 2 — Debounced save with watch-loop guard
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const sub = form.watch((values) => {
      // Suppress writes triggered by restore or post-reset setValue/reset calls
      if (isRestoring.current) return;

      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        const payload: DraftPayload = {
          name: (values.name as string) ?? "",
          email: (values.email as string) ?? "",
          subject: (values.subject as string) ?? "",
          body: (values.body as string) ?? "",
          priority: (values.priority as DraftPayload["priority"]) ?? "medium",
          category_id: (values.category_id as string) ?? "",
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      }, 500);
    });

    return () => {
      sub.unsubscribe();
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [form]);

  // ---------------------------------------------------------------------------
  // Flow 3 — clearDraft
  // ---------------------------------------------------------------------------
  const clearDraft = useCallback(() => {
    isRestoring.current = true;
    localStorage.removeItem(DRAFT_KEY);
    form.reset(DEFAULTS);
    setHasDraft(false);
    // Release guard after current microtask queue so post-reset watch is suppressed
    Promise.resolve().then(() => {
      isRestoring.current = false;
    });
  }, [form]);

  // ---------------------------------------------------------------------------
  // Flow 4 — Auto-clear on successful submission
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (isSuccess) {
      localStorage.removeItem(DRAFT_KEY);
      setHasDraft(false);
    }
  }, [isSuccess]);

  return { hasDraft, clearDraft };
}
