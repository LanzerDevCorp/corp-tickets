import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function ensureClientUser(
  email: string,
): Promise<{ userId: string | null; error: string | null }> {
  const { data: existingUser } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingUser) {
    return { userId: existingUser.id, error: null };
  }

  const { data: created, error: createError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      app_metadata: { role: "client" },
    });

  if (createError || !created?.user) {
    return {
      userId: null,
      error: createError?.message ?? "Failed to create user",
    };
  }

  return { userId: created.user.id, error: null };
}

/** Creates a browser session by generating and immediately verifying a fresh magic link OTP. */
export async function establishClientSession(
  supabase: SupabaseClient,
  email: string,
  redirectTo?: string,
): Promise<string | null> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const { data: linkData, error: linkError } =
    await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: redirectTo ?? `${siteUrl}/track` },
    });

  const hashedToken = linkData?.properties?.hashed_token;
  if (linkError || !hashedToken) {
    return linkError?.message ?? "Failed to generate sign-in link";
  }

  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: hashedToken,
  });

  return verifyError?.message ?? null;
}
