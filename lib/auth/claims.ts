import type { Role } from "./roles";

const VALID_ROLES: Role[] = ["admin", "it", "client"];

function parseRole(value: unknown): Role | undefined {
  if (typeof value === "string" && VALID_ROLES.includes(value as Role)) {
    return value as Role;
  }
  return undefined;
}

/** Application RBAC role from JWT claims (not the Postgres session role). */
export function getAppRoleFromClaims(
  claims: Record<string, unknown> | null | undefined,
): Role {
  if (!claims) return "client";

  const appMetadata = claims.app_metadata as { role?: unknown } | undefined;

  return parseRole(claims.app_role) ?? parseRole(appMetadata?.role) ?? "client";
}
