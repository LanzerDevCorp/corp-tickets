"use server";

import { getAppRoleFromClaims } from "@/lib/auth/claims";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getPostLoginRedirect } from "@/lib/auth/redirect";
import type { Role } from "@/lib/auth/roles";
import { redirect } from "next/navigation";
import { staffInviteRedirectUrl } from "@/lib/auth/staff-invite";
import { adminInviteSchema } from "@/lib/schemas/admin-invite";
import { acceptInviteSchema } from "@/lib/schemas/accept-invite";

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
  const role = getAppRoleFromClaims(data?.claims);

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
  const callerRole = getAppRoleFromClaims(data?.claims);

  if (callerRole !== "admin") {
    return { error: "Unauthorized" };
  }

  const redirectTo = staffInviteRedirectUrl();

  const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    email,
    { redirectTo }
  );

  if (error) {
    return { error: error.message ?? null };
  }

  const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(
    invited.user.id,
    { app_metadata: { role } }
  );

  if (metaError) {
    return { error: metaError.message ?? null };
  }

  const { error: roleError } = await supabaseAdmin
    .from("users")
    .update({ role })
    .eq("id", invited.user.id);

  return { error: roleError?.message ?? null };
}

export async function completeInviteSetup(
  _prevState: AuthResult,
  formData: FormData
): Promise<AuthResult> {
  const parsed = acceptInviteSchema.safeParse({
    name: formData.get("name"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  const role = getAppRoleFromClaims(claimsData?.claims);

  if (!userId) {
    return {
      error: "Your invitation link expired or is invalid. Request a new invite.",
    };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.password,
    data: { name: parsed.data.name, full_name: parsed.data.name },
  });

  if (updateError) {
    return { error: updateError.message };
  }

  const { error: profileError } = await supabaseAdmin
    .from("users")
    .update({ display_name: parsed.data.name })
    .eq("id", userId);

  if (profileError) {
    return { error: profileError.message };
  }

  redirect(getPostLoginRedirect(role));
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
