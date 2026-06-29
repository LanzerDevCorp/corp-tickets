"use client";

import Link from "next/link";
import { useTransition } from "react";
import { HoverCard } from "radix-ui";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTimeLong, formatRelativeTime } from "@/lib/format-date";
import { updateTicketStatus } from "@/app/actions/tickets";

type TicketPreviewData = {
  id: string;
  subject: string;
  body: string;
  name: string;
  email: string;
  created_at: string;
  status: string;
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function avatarTone(name: string): string {
  const tones = [
    "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
    "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    "bg-teal-500/15 text-teal-600 dark:text-teal-400",
    "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  ];
  let hash = 0;
  for (const char of name) hash = (hash + char.charCodeAt(0)) % tones.length;
  return tones[hash] ?? tones[0];
}

function TicketPreviewCard({
  ticket,
  onResolved,
}: {
  ticket: TicketPreviewData;
  onResolved?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const initials = getInitials(ticket.name) || "?";

  return (
    <div
      className={cn(
        "rounded-lg border border-zinc-200/80 bg-white shadow-xl",
        "dark:border-zinc-700/80 dark:bg-zinc-900",
        "border-l-[3px] border-l-[#1C2438] dark:border-l-indigo-400",
      )}
    >
      <div className="flex gap-3 p-4 pb-3">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold tracking-wide",
            avatarTone(ticket.name),
          )}
          aria-hidden
        >
          {initials}
        </div>
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm leading-snug text-zinc-700 dark:text-zinc-200">
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">
              {ticket.name}
            </span>{" "}
            <span className="text-zinc-500 dark:text-zinc-400">
              subió un nuevo ticket
            </span>
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            {formatRelativeTime(ticket.created_at)} (
            {formatDateTimeLong(ticket.created_at)})
          </p>
        </div>
      </div>

      <div className="mx-4 border-t border-zinc-100 dark:border-zinc-800" />

      <div className="max-h-56 overflow-y-auto px-4 py-3">
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-zinc-600 dark:text-zinc-300">
          {ticket.body}
        </p>
      </div>

      {ticket.status !== "resolved" && ticket.status !== "closed" && (
        <>
          <div className="mx-4 border-t border-zinc-100 dark:border-zinc-800" />
          <div className="flex justify-end px-4 py-2">
            <button
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await updateTicketStatus(ticket.id, "resolved");
                  onResolved?.();
                })
              }
              className="flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:bg-green-700 disabled:opacity-50"
            >
              <Check className="size-3.5" />
              Resuelto
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function TicketSubjectPreview({
  ticket,
  onSeen,
  onResolved,
}: {
  ticket: TicketPreviewData;
  onSeen?: () => void;
  onResolved?: () => void;
}) {
  return (
    <HoverCard.Root openDelay={0} closeDelay={120}>
      <HoverCard.Trigger asChild>
        <Link
          href={`/dashboard/tickets/${ticket.id}`}
          onMouseEnter={() => onSeen?.()}
          onFocus={() => onSeen?.()}
          className="inline-block max-w-[280px] truncate text-zinc-900 underline-offset-2 transition-colors hover:text-indigo-600 hover:underline dark:text-zinc-100 dark:hover:text-indigo-400"
        >
          {ticket.subject}
        </Link>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="right"
          sideOffset={8}
          className={cn(
            "z-50 w-[min(22rem,calc(100vw-2rem))]",
            "animate-in fade-in-0 zoom-in-95",
            "data-[side=bottom]:slide-in-from-top-2",
            "data-[side=left]:slide-in-from-right-2",
            "data-[side=right]:slide-in-from-left-2",
            "data-[side=top]:slide-in-from-bottom-2",
            "data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0",
            "data-[state=closed]:zoom-out-95",
          )}
        >
          <TicketPreviewCard ticket={ticket} onResolved={onResolved} />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
