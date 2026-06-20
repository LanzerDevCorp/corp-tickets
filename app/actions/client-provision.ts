"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { es } from "@/lib/i18n/es";

type ProvisionResult = {
  userId: string | null;
  alreadyExisted: boolean;
  actionLink: string | null;
  error: string | null;
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** SSR-safe magic link via /auth/confirm (not Supabase action_link with #hash). */
function buildMagicLinkConfirmUrl(
  ticketId: string,
  hashedToken: string
): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const next = encodeURIComponent(`/track/${ticketId}`);
  return `${siteUrl}/auth/confirm?token_hash=${hashedToken}&type=magiclink&next=${next}`;
}

export async function provisionClient(
  email: string,
  ticketId: string
): Promise<ProvisionResult> {
  if (!isValidEmail(email)) {
    return {
      userId: null,
      alreadyExisted: false,
      actionLink: null,
      error: es.errors.invalidEmail,
    };
  }

  // Query public.users to check if client already exists (sync'd by auth trigger)
  const { data: existingUser } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  let userId: string | null = null;
  let alreadyExisted = false;

  if (existingUser) {
    userId = existingUser.id;
    alreadyExisted = true;
  } else {
    const { data: created, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        app_metadata: { role: "client" },
      });

    if (createError || !created?.user) {
      return {
        userId: null,
        alreadyExisted: false,
        actionLink: null,
        error: createError?.message ?? es.errors.failedCreateUser,
      };
    }

    userId = created.user.id;
  }

  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/track/${ticketId}`;
  const { data: linkData, error: linkError } =
    await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });

  if (linkError) {
    return { userId, alreadyExisted, actionLink: null, error: linkError.message };
  }

  const hashedToken = linkData?.properties?.hashed_token;
  const actionLink = hashedToken
    ? buildMagicLinkConfirmUrl(ticketId, hashedToken)
    : null;

  return { userId, alreadyExisted, actionLink, error: null };
}

export async function requestMagicLink(
  email: string
): Promise<{ error: string | null }> {
  const { error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  return { error: error?.message ?? null };
}
