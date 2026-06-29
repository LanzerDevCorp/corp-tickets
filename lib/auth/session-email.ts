import type { SupabaseClient } from "@supabase/supabase-js";

export async function getAuthenticatedEmail(
  supabase: SupabaseClient,
  claims: Record<string, unknown> | null | undefined,
): Promise<string | undefined> {
  const claimEmail = claims?.email;
  if (typeof claimEmail === "string" && claimEmail.length > 0) {
    return claimEmail;
  }

  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? undefined;
}
