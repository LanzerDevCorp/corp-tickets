"use client";

import { useEffect, useRef, useState } from "react";
import { UNCATEGORIZED } from "@/lib/tickets/category-filter";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const QUEUE_FILTERS_KEY = "ticket-queue-filters";

export const DEFAULT_STATUSES = ["open", "in_progress"] as const;

const VALID_STATUSES = ["all", "open", "in_progress", "resolved", "closed"];
const VALID_PRIORITIES = ["all", "low", "medium", "high", "urgent"];
const VALID_SORT_ORDERS = ["asc", "desc"] as const;
const VALID_SORT_FIELDS = ["created_at", "status"] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SortOrder = (typeof VALID_SORT_ORDERS)[number];
export type SortField = (typeof VALID_SORT_FIELDS)[number];

export type QueueFilterState = {
  statusSelection: string[];
  priority: string;
  assignedTo: string;
  categoryIds: string[];
  sortOrder: SortOrder;
  sortField: SortField;
};

type IdRef = { id: string };

export interface UseQueueFiltersReturn {
  statusSelection: string[];
  setStatusSelection: React.Dispatch<React.SetStateAction<string[]>>;
  priority: string;
  setPriority: React.Dispatch<React.SetStateAction<string>>;
  assignedTo: string;
  setAssignedTo: React.Dispatch<React.SetStateAction<string>>;
  categoryIds: string[];
  setCategoryIds: React.Dispatch<React.SetStateAction<string[]>>;
  sortOrder: SortOrder;
  setSortOrder: React.Dispatch<React.SetStateAction<SortOrder>>;
  sortField: SortField;
  setSortField: React.Dispatch<React.SetStateAction<SortField>>;
}

// ---------------------------------------------------------------------------
// Stale-guards — drop persisted values that are no longer valid so a restored
// filter never points at a deleted category, a removed staff member, or a
// status/priority that the UI does not offer.
// ---------------------------------------------------------------------------

function sanitizeStatuses(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_STATUSES];
  const cleaned = value.filter(
    (v): v is string => typeof v === "string" && VALID_STATUSES.includes(v),
  );
  if (cleaned.length === 0) return [...DEFAULT_STATUSES];
  // "all" is exclusive; if present it wins on its own.
  if (cleaned.includes("all")) return ["all"];
  return cleaned;
}

function sanitizePriority(value: unknown): string {
  return typeof value === "string" && VALID_PRIORITIES.includes(value)
    ? value
    : "all";
}

function sanitizeAssignedTo(value: unknown, staffUsers: IdRef[]): string {
  if (value === "all" || value === "unassigned") return value;
  if (typeof value === "string" && staffUsers.some((u) => u.id === value)) {
    return value;
  }
  return "all";
}

function sanitizeCategoryIds(value: unknown, categories: IdRef[]): string[] {
  if (!Array.isArray(value)) return [];
  const valid = new Set<string>([
    ...categories.map((c) => c.id),
    UNCATEGORIZED,
  ]);
  return value.filter(
    (v): v is string => typeof v === "string" && valid.has(v),
  );
}

function sanitizeSortOrder(value: unknown): SortOrder {
  return value === "asc" || value === "desc" ? value : "desc";
}

function sanitizeSortField(value: unknown): SortField {
  return value === "status" || value === "created_at" ? value : "created_at";
}

// Single source of key ordering so the saved payload and the restore baseline
// serialize identically and compare cleanly.
function serialize(state: QueueFilterState): string {
  return JSON.stringify({
    statusSelection: state.statusSelection,
    priority: state.priority,
    assignedTo: state.assignedTo,
    categoryIds: state.categoryIds,
    sortOrder: state.sortOrder,
    sortField: state.sortField,
  });
}

const DEFAULT_STATE: QueueFilterState = {
  statusSelection: [...DEFAULT_STATUSES],
  priority: "all",
  assignedTo: "all",
  categoryIds: [],
  sortOrder: "desc",
  sortField: "created_at",
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Holds the support-queue filter state and persists it to localStorage so the
 * selection survives across browser sessions.
 *
 * SSR-safe: the initial render always uses defaults (no localStorage read on
 * the server). Persisted values are restored in a mount effect, after which
 * any change is written back.
 */
export function useQueueFilters(
  staffUsers: IdRef[],
  categories: IdRef[],
): UseQueueFiltersReturn {
  const [statusSelection, setStatusSelection] = useState<string[]>([
    ...DEFAULT_STATUSES,
  ]);
  const [priority, setPriority] = useState<string>("all");
  const [assignedTo, setAssignedTo] = useState<string>("all");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [sortField, setSortField] = useState<SortField>("created_at");

  // Hydration gate. This is STATE, not a ref, on purpose: its `false` value is
  // captured in the first render's closure, so when StrictMode invokes the save
  // effect a second time with that stale closure (still holding the default
  // values, before restore's setState has re-rendered), it bails out instead of
  // writing defaults over the value just restored. It only flips to `true` in a
  // later render whose closure also carries the restored values.
  const [hydrated, setHydrated] = useState(false);

  // Serialized snapshot of what is already in storage, so an unchanged state
  // does not trigger a redundant write.
  const lastSaved = useRef<string | null>(null);

  // -------------------------------------------------------------------------
  // Restore on mount (client-only)
  // -------------------------------------------------------------------------
  useEffect(() => {
    let restored: QueueFilterState = DEFAULT_STATE;
    try {
      const raw = localStorage.getItem(QUEUE_FILTERS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<QueueFilterState>;
        restored = {
          statusSelection: sanitizeStatuses(parsed.statusSelection),
          priority: sanitizePriority(parsed.priority),
          assignedTo: sanitizeAssignedTo(parsed.assignedTo, staffUsers),
          categoryIds: sanitizeCategoryIds(parsed.categoryIds, categories),
          sortOrder: sanitizeSortOrder(parsed.sortOrder),
          sortField: sanitizeSortField(parsed.sortField),
        };
        setStatusSelection(restored.statusSelection);
        setPriority(restored.priority);
        setAssignedTo(restored.assignedTo);
        setCategoryIds(restored.categoryIds);
        setSortOrder(restored.sortOrder);
        setSortField(restored.sortField);
      }
    } catch {
      // Malformed JSON — keep defaults.
      restored = DEFAULT_STATE;
    }
    lastSaved.current = serialize(restored);
    setHydrated(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — mount only

  // -------------------------------------------------------------------------
  // Persist on change (no write before hydration or for unchanged state)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!hydrated) return;
    const payload = serialize({
      statusSelection,
      priority,
      assignedTo,
      categoryIds,
      sortOrder,
      sortField,
    });
    if (payload === lastSaved.current) return;
    localStorage.setItem(QUEUE_FILTERS_KEY, payload);
    lastSaved.current = payload;
  }, [
    hydrated,
    statusSelection,
    priority,
    assignedTo,
    categoryIds,
    sortOrder,
    sortField,
  ]);

  return {
    statusSelection,
    setStatusSelection,
    priority,
    setPriority,
    assignedTo,
    setAssignedTo,
    categoryIds,
    setCategoryIds,
    sortOrder,
    setSortOrder,
    sortField,
    setSortField,
  };
}
