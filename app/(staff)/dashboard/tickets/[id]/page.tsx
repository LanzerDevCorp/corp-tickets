import TicketDetail from "@/components/dashboard/ticket-detail";
import { getTicketDetail, getStaffUsers } from "@/app/actions/tickets";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TicketDetailPage({ params }: PageProps) {
  const { id } = await params;

  try {
    const [ticket, staffUsers] = await Promise.all([
      getTicketDetail(id),
      getStaffUsers(),
    ]);

    return (
      <main className="flex-1 space-y-6 p-8">
        <TicketDetail initialTicket={ticket} staffUsers={staffUsers} />
      </main>
    );
  } catch (error: any) {
    console.error("[TicketDetailPage]", error);
    notFound();
  }
}
