import { getRedirectPath } from "./roles";
import type { Role } from "./roles";

export function isSafeRedirect(url: string): boolean {
  if (!url.startsWith("/")) return false;
  if (url.startsWith("//")) return false;
  if (url === "/auth/login" || url.startsWith("/auth/login?")) return false;
  return true;
}

export function getPostLoginRedirect(role: Role, next?: string | null): string {
  const fallback = getRedirectPath(role);
  if (!next) return fallback;
  return isSafeRedirect(next) ? next : fallback;
}
