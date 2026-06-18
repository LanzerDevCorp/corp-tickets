import TicketDetail from "@/components/dashboard/ticket-detail";
import { getTicketDetail, getStaffUsers } from "@/app/actions/tickets";
import { getComments } from "@/app/actions/comments";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TicketDetailPage({ params }: PageProps) {
  const { id } = await params;

  try {
    const [ticket, staffUsers, initialComments] = await Promise.all([
      getTicketDetail(id),
      getStaffUsers(),
      getComments(id),
    ]);

    return (
      <main className="flex-1 space-y-6 p-8">
        <TicketDetail
          initialTicket={ticket}
          staffUsers={staffUsers}
          initialComments={initialComments}
        />
      </main>
    );
  } catch (error: any) {
    console.error("[TicketDetailPage]", error);
    notFound();
  }
}
