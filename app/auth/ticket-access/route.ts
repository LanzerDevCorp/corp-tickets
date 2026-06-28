import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  establishClientSession,
  ensureClientUser,
} from "@/lib/auth/client-session";
import { verifyTicketAccess } from "@/lib/auth/ticket-access";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticketId = searchParams.get("ticket");
  const sig = searchParams.get("sig");

  if (!ticketId || !sig) {
    redirect("/auth/error?error=Invalid+ticket+link");
  }

  const { data: ticket, error } = await supabaseAdmin
    .from("tickets")
    .select("email")
    .eq("id", ticketId)
    .single();

  if (
    error ||
    !ticket?.email ||
    !verifyTicketAccess(ticketId, ticket.email, sig)
  ) {
    redirect("/auth/error?error=Invalid+or+expired+ticket+link");
  }

  const ensured = await ensureClientUser(ticket.email);
  if (ensured.error || !ensured.userId) {
    redirect("/auth/error?error=Could+not+prepare+client+session");
  }

  const supabase = await createClient();
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/track/${ticketId}`;
  const sessionError = await establishClientSession(
    supabase,
    ticket.email,
    redirectTo,
  );

  if (sessionError) {
    redirect(`/auth/error?error=${encodeURIComponent(sessionError)}`);
  }

  // Route through the first-access gate: new clients see the set-password
  // interstitial once; clients who already decided pass straight to the ticket.
  redirect(
    `/auth/set-password?next=${encodeURIComponent(`/track/${ticketId}`)}`,
  );
}
