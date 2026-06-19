import { getTicketDetail } from "@/app/actions/tickets";
import { getComments } from "@/app/actions/comments";
import { notFound } from "next/navigation";
import ClientTicketView from "@/components/tracking/client-ticket-view";

type PageProps = {
  params: Promise<{ ticketId: string }>;
};

export default async function ClientTrackTicketPage({ params }: PageProps) {
  const { ticketId } = await params;

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
    console.error("[ClientTrackTicketPage]", error);
    notFound();
  }
}
