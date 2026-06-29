import { describe, it, expect } from "vitest";
import {
  buildCategoryFilter,
  UNCATEGORIZED,
} from "@/lib/tickets/category-filter";

describe("buildCategoryFilter", () => {
  it("returns none for undefined input", () => {
    expect(buildCategoryFilter(undefined)).toEqual({ kind: "none" });
  });

  it("returns none for empty array", () => {
    expect(buildCategoryFilter([])).toEqual({ kind: "none" });
  });

  it("returns in for a single real UUID", () => {
    expect(buildCategoryFilter(["uuid-1"])).toEqual({
      kind: "in",
      ids: ["uuid-1"],
    });
  });

  it("returns in for multiple real UUIDs", () => {
    expect(buildCategoryFilter(["uuid-1", "uuid-2"])).toEqual({
      kind: "in",
      ids: ["uuid-1", "uuid-2"],
    });
  });

  it("returns isNull for only uncategorized sentinel", () => {
    expect(buildCategoryFilter([UNCATEGORIZED])).toEqual({ kind: "isNull" });
  });

  it("returns or for one real UUID + uncategorized", () => {
    expect(buildCategoryFilter(["uuid-1", UNCATEGORIZED])).toEqual({
      kind: "or",
      ids: ["uuid-1"],
    });
  });

  it("returns or for multiple real UUIDs + uncategorized (sentinel position-agnostic)", () => {
    const result = buildCategoryFilter([UNCATEGORIZED, "uuid-1", "uuid-2"]);
    expect(result.kind).toBe("or");
    if (result.kind === "or") {
      expect(result.ids).toContain("uuid-1");
      expect(result.ids).toContain("uuid-2");
      expect(result.ids).not.toContain(UNCATEGORIZED);
    }
  });

  it("UNCATEGORIZED constant equals the expected sentinel string", () => {
    expect(UNCATEGORIZED).toBe("uncategorized");
  });
});
