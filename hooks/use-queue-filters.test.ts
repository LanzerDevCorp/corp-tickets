/**
 * Tests for useQueueFilters — Strict TDD.
 *
 * Verifies that the support-queue filter state persists to localStorage across
 * sessions and that restored values are sanitized against the current
 * categories / staff so a stale selection can never point at deleted data.
 */

import { StrictMode } from "react";
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useQueueFilters, QUEUE_FILTERS_KEY } from "./use-queue-filters";

const STAFF = [{ id: "staff-1" }, { id: "staff-2" }];
const CATEGORIES = [{ id: "cat-1" }, { id: "cat-2" }];

function read() {
  const raw = localStorage.getItem(QUEUE_FILTERS_KEY);
  return raw ? JSON.parse(raw) : null;
}

function seed(value: unknown) {
  localStorage.setItem(QUEUE_FILTERS_KEY, JSON.stringify(value));
}

function render() {
  return renderHook(() => useQueueFilters(STAFF, CATEGORIES));
}

describe("useQueueFilters", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts with default filters when nothing is stored", () => {
    const { result } = render();

    expect(result.current.statusSelection).toEqual(["open", "in_progress"]);
    expect(result.current.priority).toBe("all");
    expect(result.current.assignedTo).toBe("all");
    expect(result.current.categoryIds).toEqual([]);
    expect(result.current.sortOrder).toBe("desc");
    expect(result.current.sortField).toBe("created_at");
  });

  it("does not write to localStorage on first mount with no changes", () => {
    render();
    expect(read()).toBeNull();
  });

  it("persists a filter change to localStorage", () => {
    const { result } = render();

    act(() => {
      result.current.setPriority("high");
      result.current.setSortOrder("asc");
    });

    expect(read()).toMatchObject({ priority: "high", sortOrder: "asc" });
  });

  it("restores persisted filters on mount", () => {
    seed({
      statusSelection: ["resolved"],
      priority: "urgent",
      assignedTo: "staff-2",
      categoryIds: ["cat-1"],
      sortOrder: "asc",
      sortField: "status",
    });

    const { result } = render();

    expect(result.current.statusSelection).toEqual(["resolved"]);
    expect(result.current.priority).toBe("urgent");
    expect(result.current.assignedTo).toBe("staff-2");
    expect(result.current.categoryIds).toEqual(["cat-1"]);
    expect(result.current.sortOrder).toBe("asc");
    expect(result.current.sortField).toBe("status");
  });

  it("keeps defaults when stored JSON is malformed", () => {
    localStorage.setItem(QUEUE_FILTERS_KEY, "{not valid json");

    const { result } = render();

    expect(result.current.priority).toBe("all");
    expect(result.current.statusSelection).toEqual(["open", "in_progress"]);
  });

  it("drops a category id that no longer exists", () => {
    seed({ categoryIds: ["cat-1", "deleted-cat"] });

    const { result } = render();

    expect(result.current.categoryIds).toEqual(["cat-1"]);
  });

  it("keeps the 'uncategorized' sentinel as a valid category id", () => {
    seed({ categoryIds: ["uncategorized", "ghost"] });

    const { result } = render();

    expect(result.current.categoryIds).toEqual(["uncategorized"]);
  });

  it("falls back to 'all' when the assigned staff member no longer exists", () => {
    seed({ assignedTo: "former-employee" });

    const { result } = render();

    expect(result.current.assignedTo).toBe("all");
  });

  it("preserves the 'unassigned' assignee option", () => {
    seed({ assignedTo: "unassigned" });

    const { result } = render();

    expect(result.current.assignedTo).toBe("unassigned");
  });

  it("collapses to defaults when stored statuses are all invalid", () => {
    seed({ statusSelection: ["bogus"] });

    const { result } = render();

    expect(result.current.statusSelection).toEqual(["open", "in_progress"]);
  });

  it("ignores an out-of-range sort order / field", () => {
    seed({ sortOrder: "sideways", sortField: "color" });

    const { result } = render();

    expect(result.current.sortOrder).toBe("desc");
    expect(result.current.sortField).toBe("created_at");
  });

  // Regression: navigating into a ticket and back remounts the queue. Under
  // React StrictMode (active in `next dev`) effects run twice, which must not
  // let a stale render overwrite the just-restored value with defaults.
  it("keeps restored filters under StrictMode double-invocation", () => {
    seed({
      priority: "high",
      statusSelection: ["resolved"],
      assignedTo: "staff-1",
    });

    const { result } = renderHook(() => useQueueFilters(STAFF, CATEGORIES), {
      wrapper: StrictMode,
    });

    expect(result.current.priority).toBe("high");
    expect(result.current.statusSelection).toEqual(["resolved"]);
    expect(result.current.assignedTo).toBe("staff-1");
    expect(read()).toMatchObject({ priority: "high" });
  });
});
