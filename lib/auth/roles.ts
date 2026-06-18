export type Role = "admin" | "it" | "client";

export const STAFF_ROLES: Role[] = ["admin", "it"];
export const ALL_ROLES: Role[] = ["admin", "it", "client"];

export function isStaff(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}

export function isAdmin(role: Role): boolean {
  return role === "admin";
}

export function getRedirectPath(role: Role): string {
  return isStaff(role) ? "/dashboard" : "/track";
}

export function hasAccess(role: Role, allowedRoles: Role[]): boolean {
  return allowedRoles.includes(role);
}
