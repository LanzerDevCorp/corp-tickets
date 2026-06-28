import TicketQueue from "@/components/dashboard/ticket-queue";
import {
  getTickets,
  getCategories,
  getStaffUsers,
} from "@/app/actions/tickets";
import { t } from "@/lib/i18n/t";

export default async function DashboardPage() {
  const [initialTickets, categories, staffUsers] = await Promise.all([
    getTickets({ statuses: ["open", "in_progress"], sortOrder: "desc" }),
    getCategories(),
    getStaffUsers(),
  ]);

  return (
    <main className="flex-1 space-y-6 p-8">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="bg-gradient-to-r from-zinc-900 to-zinc-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent dark:from-zinc-100 dark:to-zinc-400">
            {t("dashboard.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("dashboard.subtitle")}
          </p>
        </div>
      </div>
      <TicketQueue
        initialTickets={initialTickets}
        categories={categories}
        staffUsers={staffUsers}
      />
    </main>
  );
}
