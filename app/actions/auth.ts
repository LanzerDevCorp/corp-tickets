"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getPostLoginRedirect } from "@/lib/auth/redirect";
import type { Role } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import { adminInviteSchema } from "@/lib/schemas/admin-invite";

type AuthResult = { error: string | null; role?: Role };
type InviteResult = { error: string | null };

export async function loginUser(
  _prevState: AuthResult,
  formData: FormData
): Promise<AuthResult> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Invalid credentials" };
  }

  const { data } = await supabase.auth.getClaims();
  const role = (data?.claims?.role as Role) ?? "client";

  redirect(getPostLoginRedirect(role));
}

export async function logoutUser(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function inviteUser(
  email: string,
  role: "it" | "admin"
): Promise<InviteResult> {
  const parsed = adminInviteSchema.safeParse({ email, role });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const callerRole = data?.claims?.role as Role | undefined;

  if (callerRole !== "admin") {
    return { error: "Unauthorized" };
  }

  const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/update-password`,
    data: { role },
  });

  return { error: error?.message ?? null };
}

export async function resetPassword(
  email: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/update-password`,
  });
  // Always return null — no user enumeration
  return { error: null };
}
