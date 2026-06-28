import type { User } from "@supabase/supabase-js";
import type { Role } from "@/lib/auth/roles";

export function staffInviteRedirectUrl(): string {
  return `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/accept-invite`;
}

export function isStaffRole(role: Role): role is "admin" | "it" {
  return role === "admin" || role === "it";
}

/** Staff invited via panel who have not yet confirmed their email. */
export function isPendingStaffInvite(
  authUser: Pick<User, "invited_at" | "email_confirmed_at"> | undefined,
  role: Role,
): boolean {
  if (!authUser || !isStaffRole(role)) return false;
  return Boolean(authUser.invited_at) && !authUser.email_confirmed_at;
}
