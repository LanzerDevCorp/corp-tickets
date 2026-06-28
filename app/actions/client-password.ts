"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAppRoleFromClaims } from "@/lib/auth/claims";

const MIN_PASSWORD_LENGTH = 8;

type ActionResult = { error: string | null };

export type PasswordDecision = {
  /** True once the client has set a password. */
  hasPassword: boolean;
  /** True once the client has either set a password OR dismissed the prompt. */
  decided: boolean;
  error: string | null;
};

/**
 * Resolves the authenticated client identity from the live session.
 * Returns a null userId for anyone who is not an authenticated client.
 */
async function resolveClient(): Promise<{ userId: string | null }> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (!claims) {
    return { userId: null };
  }

  const role = getAppRoleFromClaims(claims);
  const userId = typeof claims.sub === "string" ? claims.sub : null;

  if (role !== "client" || !userId) {
    return { userId: null };
  }

  return { userId };
}

/**
 * Sets the client's password server-side and stamps `password_set_at` so the
 * first-access interstitial is never shown again. Atomic intent: the stamp only
 * happens after the auth update succeeds.
 */
export async function setClientPassword(
  password: string,
): Promise<ActionResult> {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    };
  }

  const { userId } = await resolveClient();
  if (!userId) {
    return { error: "No autorizado" };
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    { password },
  );
  if (updateError) {
    return { error: updateError.message };
  }

  const { error: stampError } = await supabaseAdmin
    .from("users")
    .update({ password_set_at: new Date().toISOString() })
    .eq("id", userId);
  if (stampError) {
    return { error: stampError.message };
  }

  return { error: null };
}

/**
 * Records that the client chose to skip setting a password. Suppresses the
 * first-access interstitial without granting a password.
 */
export async function dismissPasswordPrompt(): Promise<ActionResult> {
  const { userId } = await resolveClient();
  if (!userId) {
    return { error: "No autorizado" };
  }

  const { error } = await supabaseAdmin
    .from("users")
    .update({ password_prompt_dismissed_at: new Date().toISOString() })
    .eq("id", userId);

  return { error: error?.message ?? null };
}

/**
 * Reads the client's password-decision state. Drives both the first-access
 * interstitial gating and the account-menu "create vs change password" label.
 */
export async function getPasswordDecision(): Promise<PasswordDecision> {
  const { userId } = await resolveClient();
  if (!userId) {
    return { hasPassword: false, decided: false, error: "No autorizado" };
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("password_set_at, password_prompt_dismissed_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return { hasPassword: false, decided: false, error: error.message };
  }

  const hasPassword = Boolean(data?.password_set_at);
  const decided = hasPassword || Boolean(data?.password_prompt_dismissed_at);

  return { hasPassword, decided, error: null };
}
