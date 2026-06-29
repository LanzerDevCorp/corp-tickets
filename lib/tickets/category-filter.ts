/**
 * Pure helper for building category filter descriptors from a list of
 * category IDs (real UUIDs and/or the "uncategorized" sentinel).
 *
 * Deliberately has NO Next.js or Supabase imports so it can be unit-tested
 * in a plain Vitest environment without mocking server internals.
 */

export const UNCATEGORIZED = "uncategorized" as const;

export type CategoryFilter =
  | { kind: "none" }
  | { kind: "in"; ids: string[] }
  | { kind: "isNull" }
  | { kind: "or"; ids: string[] };

/**
 * Converts a raw category_ids selection into a typed descriptor that the
 * server action can switch on to build the appropriate Supabase query clause.
 *
 * Branches:
 *  - undefined / empty            → { kind: "none" }      (no constraint)
 *  - only real UUIDs              → { kind: "in", ids }   (.in())
 *  - only "uncategorized"         → { kind: "isNull" }    (.is(null))
 *  - real UUIDs + "uncategorized" → { kind: "or", ids }   (.or())
 */
export function buildCategoryFilter(
  category_ids: string[] | undefined,
): CategoryFilter {
  if (!category_ids || category_ids.length === 0) {
    return { kind: "none" };
  }

  const realIds = category_ids.filter((id) => id !== UNCATEGORIZED);
  const hasUncategorized = category_ids.includes(UNCATEGORIZED);

  if (realIds.length > 0 && hasUncategorized) {
    return { kind: "or", ids: realIds };
  }

  if (realIds.length > 0) {
    return { kind: "in", ids: realIds };
  }

  // Only "uncategorized" sentinel remains
  return { kind: "isNull" };
}
