"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";

type ProvisionResult = {
  userId: string | null;
  alreadyExisted: boolean;
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
    return { userId: null, alreadyExisted: false, error: "Invalid email address" };
  }

  const { data: existing } = await supabaseAdmin.auth.admin.getUserByEmail(email);

  let userId: string | null = null;
  let alreadyExisted = false;

  if (existing?.user) {
    userId = existing.user.id;
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
        error: createError?.message ?? "Failed to create user",
      };
    }

    userId = created.user.id;
  }

  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/track/${ticketId}`;
  const { error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });

  if (linkError) {
    return { userId, alreadyExisted, error: linkError.message };
  }

  return { userId, alreadyExisted, error: null };
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
