"use server";

import { createClient } from "@/lib/supabase/server";
import { provisionClient } from "@/app/actions/client-provision";

type TicketResult = { error: string | null; ticketId?: string };

export async function submitTicket(
  _prevState: TicketResult,
  formData: FormData
): Promise<TicketResult> {
  const email = formData.get("email") as string;
  const subject = formData.get("subject") as string;
  const description = formData.get("description") as string;

  const supabase = await createClient();

  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert({ email, subject, description })
    .select()
    .single();

  if (error || !ticket) {
    return { error: error?.message ?? "Failed to create ticket" };
  }

  // Best-effort: provision client account + send magic link
  // Does not block ticket creation on failure
  const { error: provisionError } = await provisionClient(email, ticket.id);
  if (provisionError) {
    console.error("[provisionClient]", provisionError);
  }

  return { error: null, ticketId: ticket.id };
}
