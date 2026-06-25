import TicketDetail from "@/components/dashboard/ticket-detail";
import { getTicketDetail, getStaffUsers, getCategories } from "@/app/actions/tickets";
import { getComments } from "@/app/actions/comments";
import { getTicketAttachments } from "@/app/actions/attachments";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TicketDetailPage({ params }: PageProps) {
  const { id } = await params;

  try {
    const [ticket, staffUsers, categories, initialComments, initialAttachments] = await Promise.all([
      getTicketDetail(id),
      getStaffUsers(),
      getCategories(),
      getComments(id),
      getTicketAttachments(id).catch(() => []),
    ]);

    return (
      <main className="flex-1 space-y-6 p-8">
        <TicketDetail
          initialTicket={ticket}
          staffUsers={staffUsers}
          categories={categories}
          initialComments={initialComments}
          initialAttachments={initialAttachments}
        />
      </main>
    );
  } catch (error: any) {
    console.error("[TicketDetailPage]", error);
    notFound();
  }
}
