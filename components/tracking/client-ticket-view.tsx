"use client";

import { useState } from "react";
import { Calendar, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import CommentThread from "@/components/dashboard/comment-thread";
import ClientCommentForm from "@/components/tracking/client-comment-form";
import { type CommentWithAuthor } from "@/app/actions/comments";
import { type AttachmentItem } from "@/app/actions/attachments";
import AttachmentList from "@/components/dashboard/attachment-list";
import { formatDateTime } from "@/lib/format-date";
import { formatTicketReference } from "@/lib/tickets/reference";
import { t } from "@/lib/i18n/t";
import { statusLabel, priorityLabel } from "@/lib/i18n/maps";

type ClientTicketViewProps = {
  initialTicket: {
    id: string;
    subject: string;
    body: string;
    status: string;
    priority: string;
    created_at: string;
    closure_reason?: string | null;
    category?: { name: string } | null;
    assignee?: { display_name: string | null; email: string } | null;
  };
  initialComments: CommentWithAuthor[];
  initialAttachments?: AttachmentItem[];
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  medium:
    "bg-yellow-500/10 text-yellow-600 border-yellow-500/20 dark:text-yellow-500",
  high: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  urgent: "bg-red-500/10 text-red-500 border-red-500/20",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  in_progress: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  resolved: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
  closed: "bg-rose-500/10 text-rose-500 border-rose-500/20",
};

export default function ClientTicketView({
  initialTicket,
  initialComments,
  initialAttachments = [],
}: ClientTicketViewProps) {
  const [comments, setComments] =
    useState<CommentWithAuthor[]>(initialComments);
  const isClosed = initialTicket.status === "closed";

  return (
    <div className="space-y-6">
      <Card className="border-zinc-200 bg-white/50 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/50">
        <CardHeader className="border-b border-zinc-100 pb-6 dark:border-zinc-900">
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className={`${STATUS_COLORS[initialTicket.status] ?? ""} px-2.5 py-0.5 text-[10px] tracking-wider uppercase`}
            >
              {statusLabel(initialTicket.status)}
            </Badge>
            <Badge
              variant="outline"
              className={`${PRIORITY_COLORS[initialTicket.priority] ?? ""} px-2.5 py-0.5 text-[10px] tracking-wider uppercase`}
            >
              {priorityLabel(initialTicket.priority)}
            </Badge>
            <Badge
              variant="secondary"
              className="bg-zinc-100 text-[10px] tracking-wider text-zinc-700 uppercase dark:bg-zinc-900 dark:text-zinc-300"
            >
              {initialTicket.category?.name ?? t("common.general")}
            </Badge>
          </div>
          <CardTitle className="text-2xl font-bold text-zinc-950 dark:text-zinc-50">
            {initialTicket.subject}
          </CardTitle>
          <CardDescription className="mt-1 font-mono text-xs tracking-wider text-zinc-400 uppercase">
            #{formatTicketReference(initialTicket.id)}
          </CardDescription>
          <CardDescription className="mt-3 flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-1.5 text-zinc-500">
              <User className="h-3.5 w-3.5" />
              {t("common.assigned")}{" "}
              <strong className="font-medium text-zinc-700 dark:text-zinc-300">
                {initialTicket.assignee?.display_name ||
                  initialTicket.assignee?.email ||
                  t("common.pendingAssignment")}
              </strong>
            </span>
            <span className="flex items-center gap-1.5 text-zinc-500">
              <Calendar className="h-3.5 w-3.5" />
              {formatDateTime(initialTicket.created_at)}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold tracking-wider text-zinc-400 uppercase">
              {t("common.description")}
            </h3>
            <p className="leading-relaxed whitespace-pre-line text-zinc-800 dark:text-zinc-200">
              {initialTicket.body}
            </p>
          </div>

          {isClosed && initialTicket.closure_reason && (
            <div className="mt-8 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
              <h4 className="mb-1 text-sm font-semibold tracking-wider text-rose-500 uppercase">
                {t("dashboard.closureReason")}
              </h4>
              <p className="text-sm text-zinc-700 italic dark:text-zinc-300">
                {initialTicket.closure_reason}
              </p>
            </div>
          )}

          {initialAttachments.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-semibold tracking-wider text-zinc-400 uppercase">
                Attachments
              </h3>
              <AttachmentList attachments={initialAttachments} />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold tracking-wider text-zinc-400 uppercase">
          {t("common.conversation")}
        </h3>
        <CommentThread comments={comments} />
        {isClosed ? (
          <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
            {t("tracking.ticketClosedNotice")}
          </p>
        ) : (
          <ClientCommentForm
            ticketId={initialTicket.id}
            onPosted={(comment) => setComments((prev) => [...prev, comment])}
          />
        )}
      </div>
    </div>
  );
}
