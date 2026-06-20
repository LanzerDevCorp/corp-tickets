import { createClient } from "@/lib/supabase/server";
import { getTicketDetail } from "@/app/actions/tickets";
import { getComments } from "@/app/actions/comments";
import { notFound } from "next/navigation";
import ClientTicketView from "@/components/tracking/client-ticket-view";
import { es } from "@/lib/i18n/es";

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
    const [ticket, initialComments] = await Promise.all([
      getTicketDetail(ticketId),
      getComments(ticketId),
    ]);

    return (
      <ClientTicketView
        initialTicket={ticket}
        initialComments={initialComments}
      />
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === es.errors.notAuthorized
    ) {
      return null;
    }

    console.error("[ClientTrackTicketPage]", error);
    notFound();
  }
}
