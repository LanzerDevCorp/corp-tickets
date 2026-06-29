"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  ensureClientUser,
  establishClientSession,
} from "@/lib/auth/client-session";
import { buildTicketAccessUrl } from "@/lib/auth/ticket-access";
import { sendTicketAccessEmail } from "@/lib/notifications/tickets";

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
  ticketId: string,
): Promise<ProvisionResult> {
  if (!isValidEmail(email)) {
    return {
      userId: null,
      alreadyExisted: false,
      actionLink: null,
      error: "Correo electrónico inválido",
    };
  }

  const { data: existingUser } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  const alreadyExisted = Boolean(existingUser);
  const ensured = existingUser
    ? { userId: existingUser.id, error: null }
    : await ensureClientUser(email);

  if (ensured.error || !ensured.userId) {
    return {
      userId: null,
      alreadyExisted: false,
      actionLink: null,
      error: ensured.error ?? "No se pudo crear el usuario",
    };
  }

  const userId = ensured.userId;

  let actionLink: string | null = null;
  try {
    actionLink = buildTicketAccessUrl(ticketId, email);
  } catch (err) {
    return {
      userId,
      alreadyExisted,
      actionLink: null,
      error: err instanceof Error ? err.message : "No se pudo crear el usuario",
    };
  }

  return { userId, alreadyExisted, actionLink, error: null };
}

export async function requestMagicLink(
  email: string,
): Promise<{ error: string | null }> {
  const trimmed = email.trim();

  if (!isValidEmail(trimmed)) {
    return { error: "Correo electrónico inválido" };
  }

  const { data: ticket, error: lookupError } = await supabaseAdmin
    .from("tickets")
    .select("id")
    .ilike("email", trimmed)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    console.error("[requestMagicLink] ticket lookup failed", lookupError);
    return {
      error: "No pudimos enviar el enlace. Intenta de nuevo en unos minutos.",
    };
  }

  if (!ticket) {
    // Avoid email enumeration — show the same success copy in the UI.
    return { error: null };
  }

  return sendTicketAccessEmail(ticket.id);
}

export { ensureClientUser, establishClientSession };
