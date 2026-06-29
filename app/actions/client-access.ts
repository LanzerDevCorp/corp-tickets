"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  ensureClientUser,
  establishClientSession,
} from "@/lib/auth/client-session";
import {
  isValidTicketReferenceInput,
  ticketMatchesReference,
} from "@/lib/tickets/reference";

type AccessResult = { error: string | null };

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function findTicketByEmailAndReference(
  email: string,
  ticketRef: string,
): Promise<{ id: string; email: string } | null> {
  const { data, error } = await supabaseAdmin
    .from("tickets")
    .select("id, email, created_at")
    .ilike("email", email.trim())
    .order("created_at", { ascending: false });

  if (error || !data?.length) {
    return null;
  }

  const match = data.find((row) => ticketMatchesReference(row.id, ticketRef));
  return match ? { id: match.id, email: match.email } : null;
}

export async function accessTicketWithReference(
  email: string,
  ticketRef: string,
): Promise<AccessResult> {
  const trimmedEmail = email.trim();
  const trimmedRef = ticketRef.trim();

  if (!isValidEmail(trimmedEmail)) {
    return { error: "Correo electrónico inválido" };
  }

  if (!isValidTicketReferenceInput(trimmedRef)) {
    return {
      error:
        "El número de ticket debe ser la referencia de 8 caracteres o el ID completo.",
    };
  }

  const ticket = await findTicketByEmailAndReference(trimmedEmail, trimmedRef);
  if (!ticket) {
    return {
      error:
        "No encontramos un ticket con ese correo y número. Verifica los datos.",
    };
  }

  const ensured = await ensureClientUser(ticket.email);
  if (ensured.error || !ensured.userId) {
    return {
      error: "No pudimos enviar el enlace. Intenta de nuevo en unos minutos.",
    };
  }

  const supabase = await createClient();
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/track/${ticket.id}`;
  const sessionError = await establishClientSession(
    supabase,
    ticket.email,
    redirectTo,
  );

  if (sessionError) {
    return {
      error: "No pudimos enviar el enlace. Intenta de nuevo en unos minutos.",
    };
  }

  redirect(`/track/${ticket.id}`);
}
