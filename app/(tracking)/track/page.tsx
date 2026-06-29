import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getClientTickets } from "@/app/actions/client-tickets";
import ClientTicketList from "@/components/tracking/client-ticket-list";

export default async function TrackIndexPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/portal");
  }

  const tickets = await getClientTickets();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Mis tickets
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Revisa el estado de tus solicitudes de soporte.
        </p>
      </div>
      <ClientTicketList tickets={tickets} />
    </div>
  );
}
