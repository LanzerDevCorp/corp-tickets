"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatDateTimeLong,
  formatRelativeTime,
} from "@/lib/format-date";
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
        "border-l-[3px] border-l-[#1C2438] dark:border-l-indigo-400"
      )}
    >
      <div className="flex gap-3 p-4 pb-3">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold tracking-wide",
            avatarTone(ticket.name)
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
              submitted a new ticket
            </span>
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            {formatRelativeTime(ticket.created_at)} ({formatDateTimeLong(ticket.created_at)})
          </p>
        </div>
      </div>

      <div className="mx-4 border-t border-zinc-100 dark:border-zinc-800" />

      <div className="max-h-56 overflow-y-auto px-4 py-3">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
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
              Mark as resolved
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
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cardWidth = 352;
    const left = Math.min(rect.left, window.innerWidth - cardWidth - 16);
    setPosition({ top: rect.bottom + 8, left: Math.max(16, left) });
  }, []);

  const showPreview = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    updatePosition();
    setOpen(true);
    onSeen?.();
  };

  const hidePreview = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  const cancelHide = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  useEffect(() => {
    if (!open) return;
    const sync = () => updatePosition();
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [open, updatePosition]);

  return (
    <>
      <Link
        ref={triggerRef}
        href={`/dashboard/tickets/${ticket.id}`}
        onMouseEnter={showPreview}
        onMouseLeave={hidePreview}
        onFocus={showPreview}
        onBlur={hidePreview}
        className="block max-w-[280px] truncate text-zinc-900 underline-offset-2 transition-colors hover:text-indigo-600 hover:underline dark:text-zinc-100 dark:hover:text-indigo-400"
      >
        {ticket.subject}
      </Link>

      {open &&
        createPortal(
          <div
            className="fixed z-50 w-[min(22rem,calc(100vw-2rem))] animate-in fade-in-0 zoom-in-95 duration-200"
            style={{ top: position.top, left: position.left }}
            onMouseEnter={cancelHide}
            onMouseLeave={hidePreview}
          >
            <TicketPreviewCard ticket={ticket} onResolved={onResolved} />
          </div>,
          document.body
        )}
    </>
  );
}
