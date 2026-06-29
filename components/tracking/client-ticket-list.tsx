import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format-date";
import type { ClientTicketListItem } from "@/app/actions/client-tickets";

const STATUS_LABELS: Record<string, string> = {
  open: "Abierto",
  in_progress: "En progreso",
  resolved: "Resuelto",
  closed: "Cerrado",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  in_progress:
    "bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:text-indigo-400",
  resolved:
    "bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-400",
  closed: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
};

type ClientTicketListProps = {
  tickets: ClientTicketListItem[];
};

export default function ClientTicketList({ tickets }: ClientTicketListProps) {
  if (tickets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white/60 px-6 py-12 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
        <p className="text-base font-medium text-zinc-800 dark:text-zinc-100">
          Aún no tienes tickets
        </p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Cuando envíes una solicitud de soporte, aparecerá aquí.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Crear ticket
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="hidden border-b border-zinc-100 px-4 py-3 text-xs font-medium tracking-wider text-zinc-400 uppercase sm:grid sm:grid-cols-[1fr_auto_auto] sm:gap-4 dark:border-zinc-800">
        <span>Asunto</span>
        <span>Estado</span>
        <span className="text-right">Creado</span>
      </div>
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {tickets.map((ticket) => (
          <li key={ticket.id}>
            <Link
              href={`/track/${ticket.id}`}
              className="group block px-4 py-4 transition-colors hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none focus-visible:ring-inset sm:grid sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-4 dark:hover:bg-zinc-800/50"
            >
              <div className="flex min-w-0 items-start gap-3">
                {ticket.hasNewActivity ? (
                  <span
                    className="activity-dot mt-1.5 inline-flex size-2.5 shrink-0 rounded-full bg-teal-500 ring-4 ring-teal-500/20 motion-safe:animate-pulse motion-reduce:animate-none"
                    aria-label="Actividad nueva"
                  />
                ) : (
                  <span
                    className="mt-1.5 inline-flex size-2.5 shrink-0"
                    aria-hidden
                  />
                )}
                <span className="truncate font-medium text-zinc-900 group-hover:text-teal-700 dark:text-zinc-50 dark:group-hover:text-teal-400">
                  {ticket.subject}
                </span>
              </div>
              <div className="mt-2 sm:mt-0">
                <Badge
                  variant="outline"
                  className={`${STATUS_COLORS[ticket.status] ?? ""} text-[10px] tracking-wider uppercase`}
                >
                  {STATUS_LABELS[ticket.status] ?? ticket.status}
                </Badge>
              </div>
              <time
                dateTime={ticket.created_at}
                className="mt-1 block text-sm text-zinc-500 tabular-nums sm:mt-0 sm:text-right dark:text-zinc-400"
              >
                {formatDate(ticket.created_at)}
              </time>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
