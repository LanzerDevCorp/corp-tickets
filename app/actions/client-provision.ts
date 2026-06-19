"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";

type ProvisionResult = {
  userId: string | null;
  alreadyExisted: boolean;
  actionLink: string | null;
  error: string | null;
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
      error: "Invalid email address",
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
        error: createError?.message ?? "Failed to create user",
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

  const actionLink = linkData?.properties?.action_link ?? null;

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
