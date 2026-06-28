import { createClient } from "@/lib/supabase/server";
import { getTicketDetail } from "@/app/actions/tickets";
import { markTicketViewed } from "@/app/actions/client-tickets";
import { getComments } from "@/app/actions/comments";
import { getTicketAttachments } from "@/app/actions/attachments";
import { notFound } from "next/navigation";
import ClientTicketView from "@/components/tracking/client-ticket-view";

type PageProps = {
  params: Promise<{ ticketId: string }>;
};

export default async function ClientTrackTicketPage({ params }: PageProps) {
  const { ticketId } = await params;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;

  if (!userId) {
    return null;
  }

  try {
    const [ticket, initialComments, initialAttachments] = await Promise.all([
      getTicketDetail(ticketId),
      getComments(ticketId),
      getTicketAttachments(ticketId).catch(() => []),
    ]);

    // Best-effort: view tracking must never block access to the ticket.
    await markTicketViewed(ticketId).catch((err) =>
      console.warn("[ClientTrackTicketPage] markTicketViewed failed:", err),
    );

    return (
      <ClientTicketView
        initialTicket={ticket}
        initialComments={initialComments}
        initialAttachments={initialAttachments}
      />
    );
  } catch (error) {
    if (error instanceof Error && error.message === "No autorizado") {
      return null;
    }

    console.error("[ClientTrackTicketPage]", error);
    notFound();
  }
}
