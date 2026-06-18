"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getPostLoginRedirect } from "@/lib/auth/redirect";
import type { Role } from "@/lib/auth/roles";
import { redirect } from "next/navigation";

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

export async function inviteUser(email: string): Promise<InviteResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const role = data?.claims?.role as Role | undefined;

  if (role !== "admin") {
    throw new Error("Not authorized: only admins can invite users");
  }

  const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/update-password`,
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
