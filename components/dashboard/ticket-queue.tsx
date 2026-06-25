"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getTickets, markTicketAsSeen } from "@/app/actions/tickets";
import { useTicketQueueRealtime } from "@/hooks/use-ticket-queue-realtime";
import { NewTicketHighlight } from "@/components/dashboard/ticket-new-animation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectGroup,
  MultiSelectItem,
  MultiSelectTrigger,
  MultiSelectValue,
} from "@/components/ui/multi-select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, Filter, ArrowUpDown } from "lucide-react";
import { formatDate } from "@/lib/format-date";
import { TicketSubjectPreview } from "@/components/dashboard/ticket-subject-preview";
import { t } from "@/lib/i18n/t";
import { statusLabel, priorityLabel } from "@/lib/i18n/maps";

type QueueTicket = {
  id: string;
  subject: string;
  body: string;
  name: string;
  email: string;
  status: string;
  priority: string;
  created_at: string;
  first_seen_at: string | null;
  category?: { name: string } | null;
  assignee?: { display_name?: string | null; email?: string | null } | null;
};

type TicketQueueProps = {
  initialTickets: QueueTicket[];
  categories: { id: string; name: string }[];
  staffUsers: { id: string; display_name?: string | null; email?: string | null }[];
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  medium: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20 dark:text-yellow-500",
  high: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  urgent: "bg-red-500/10 text-red-500 border-red-500/20 animate-pulse",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  in_progress: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  resolved: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
  closed: "bg-rose-500/10 text-rose-500 border-rose-500/20",
};

const STATUS_DOT_COLORS: Record<string, string> = {
  open: "bg-emerald-500",
  in_progress: "bg-indigo-500",
  resolved: "bg-zinc-400",
  closed: "bg-rose-500",
};

const DEFAULT_STATUSES = ["open", "in_progress"];

function normalizeStatusSelection(prev: string[], next: string[]): string[] {
  if (next.length === 0) return [...DEFAULT_STATUSES];
  const added = next.find((v) => !prev.includes(v));
  if (added === "all") return ["all"];
  if (prev.includes("all") && added) return [added];
  if (next.includes("all")) return next.filter((v) => v !== "all");
  return next;
}

export default function TicketQueue({
  initialTickets,
  categories,
  staffUsers,
}: TicketQueueProps) {
  // Realtime subscription: invalidates the ticket query on INSERT/UPDATE events.
  useTicketQueueRealtime();

  // Optimistic "seen" state: tracks tickets the current user has hovered over
  // before the Realtime UPDATE propagates from markTicketAsSeen.
  const [seenLocally, setSeenLocally] = useState<Set<string>>(new Set());

  // Optimistic handler: immediately hides the animation on the acting client,
  // then calls the server action. Rolls back on error.
  const onSeen = useCallback(async (id: string) => {
    setSeenLocally((prev) => new Set(prev).add(id));
    try {
      await markTicketAsSeen(id);
    } catch {
      setSeenLocally((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const [statusSelection, setStatusSelection] = useState<string[]>([...DEFAULT_STATUSES]);

  const statusBadgeLabels = useMemo(
    () =>
      (["open", "in_progress", "resolved", "closed"] as const).reduce(
        (acc, s) => ({
          ...acc,
          [s]: (
            <span className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${STATUS_DOT_COLORS[s]}`} />
              {statusLabel(s)}
            </span>
          ),
        }),
        {} as Record<string, React.ReactNode>,
      ),
    [],
  );
  const [priority, setPriority] = useState<string>("all");
  const [assignedTo, setAssignedTo] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const filters = {
    statuses: statusSelection.includes("all") ? undefined : statusSelection,
    priority: priority === "all" ? undefined : priority,
    assigned_to: assignedTo === "all" ? undefined : assignedTo,
    sortOrder,
  };

  const { data: tickets = initialTickets, refetch, isFetching } = useQuery({
    queryKey: ["tickets", filters],
    queryFn: () => getTickets(filters),
    placeholderData: (prev) => prev ?? initialTickets,
    refetchOnWindowFocus: false,
  });

  return (
    <Card className="border-zinc-200 bg-white/50 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-bold tracking-tight">
          {t("dashboard.supportQueue")}
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          {t("common.refresh")}
        </Button>
      </CardHeader>
      <CardContent>
        {/* Filters Panel */}
        <div className="mb-6 flex flex-col gap-2 rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-900 dark:bg-zinc-900/50 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <div className="flex items-center gap-2 text-zinc-500 text-sm">
            <Filter className="h-4 w-4" />
            <span>{t("common.filters")}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            {/* Status Filter */}
            <MultiSelect
              values={statusSelection}
              onValuesChange={(next) =>
                setStatusSelection((prev) => normalizeStatusSelection(prev, next))
              }
            >
              <MultiSelectTrigger className="min-w-[200px] bg-white dark:bg-zinc-900">
                <MultiSelectValue placeholder={t("dashboard.status")} />
              </MultiSelectTrigger>
              <MultiSelectContent search={false}>
                <MultiSelectGroup>
                  <MultiSelectItem value="all">
                    {t("dashboard.allStatuses")}
                  </MultiSelectItem>
                  {(["open", "in_progress", "resolved", "closed"] as const).map((s) => (
                    <MultiSelectItem
                      key={s}
                      value={s}
                      badgeLabel={statusBadgeLabels[s]}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${STATUS_DOT_COLORS[s]}`} />
                        {statusLabel(s)}
                      </span>
                    </MultiSelectItem>
                  ))}
                </MultiSelectGroup>
              </MultiSelectContent>
            </MultiSelect>

            {/* Priority Filter */}
            <div className="w-[170px] shrink-0">
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="bg-white dark:bg-zinc-900">
                  <SelectValue placeholder={t("dashboard.priority")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("dashboard.allPriorities")}</SelectItem>
                  <SelectItem value="low">{priorityLabel("low")}</SelectItem>
                  <SelectItem value="medium">{priorityLabel("medium")}</SelectItem>
                  <SelectItem value="high">{priorityLabel("high")}</SelectItem>
                  <SelectItem value="urgent">{priorityLabel("urgent")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Assigned To Filter */}
            <div className="w-[210px] shrink-0">
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger className="bg-white dark:bg-zinc-900">
                  <SelectValue placeholder={t("dashboard.assignee")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("dashboard.allAssignees")}</SelectItem>
                  <SelectItem value="unassigned">{t("common.unassigned")}</SelectItem>
                  {staffUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.display_name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sort Order Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
            title={t("common.toggleSortOrder")}
            className="sm:ml-auto hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>

        {/* Tickets Table */}
        <div className="rounded-xl border border-zinc-100 overflow-x-auto dark:border-zinc-900">
          <Table>
            <TableHeader className="bg-zinc-50 dark:bg-zinc-900/40">
              <TableRow>
                <TableHead className="font-semibold min-w-[220px]">{t("dashboard.subject")}</TableHead>
                <TableHead className="font-semibold min-w-[140px]">{t("dashboard.requester")}</TableHead>
                <TableHead className="font-semibold min-w-[180px]">{t("dashboard.email")}</TableHead>
                <TableHead className="font-semibold w-[120px]">{t("dashboard.category")}</TableHead>
                <TableHead className="font-semibold w-[120px]">{t("dashboard.status")}</TableHead>
                <TableHead className="font-semibold w-[120px]">{t("dashboard.priority")}</TableHead>
                <TableHead className="font-semibold w-[180px]">{t("dashboard.assignedTo")}</TableHead>
                <TableHead className="font-semibold w-[150px] text-right">{t("common.created")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-zinc-400">
                    {t("dashboard.noTickets")}
                  </TableCell>
                </TableRow>
              ) : (
                tickets.map((ticket) => {
                  const isNew =
                    ticket.first_seen_at == null && !seenLocally.has(ticket.id);
                  return (
                  <TableRow
                    key={ticket.id}
                    className="relative hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors"
                  >
                    <TableCell className="font-medium align-top py-3">
                      <NewTicketHighlight isNew={isNew} />
                      <TicketSubjectPreview
                        ticket={ticket}
                        onSeen={isNew ? () => void onSeen(ticket.id) : undefined}
                      />
                    </TableCell>
                    <TableCell className="text-zinc-800 dark:text-zinc-200 align-top py-3">
                      <span className="block truncate max-w-[160px]" title={ticket.name}>
                        {ticket.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-zinc-500 dark:text-zinc-400 align-top py-3">
                      <a
                        href={`mailto:${ticket.email}`}
                        className="block truncate max-w-[200px] hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        title={ticket.email}
                      >
                        {ticket.email}
                      </a>
                    </TableCell>
                    <TableCell className="text-zinc-600 dark:text-zinc-400 align-top py-3">
                      {ticket.category?.name || t("common.general")}
                    </TableCell>
                    <TableCell className="align-top py-3">
                      <Badge
                        variant="outline"
                        className={`${STATUS_COLORS[ticket.status]} rounded-md font-medium uppercase tracking-wider text-[10px] px-2 py-0.5`}
                      >
                        {statusLabel(ticket.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top py-3">
                      <Badge
                        variant="outline"
                        className={`${PRIORITY_COLORS[ticket.priority]} rounded-md font-medium uppercase tracking-wider text-[10px] px-2 py-0.5`}
                      >
                        {priorityLabel(ticket.priority)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-zinc-600 dark:text-zinc-400 align-top py-3">
                      {ticket.assignee
                        ? (ticket.assignee.display_name || ticket.assignee.email)
                        : <span className="text-zinc-400 dark:text-zinc-600 italic">{t("common.unassigned")}</span>
                      }
                    </TableCell>
                    <TableCell className="text-zinc-600 dark:text-zinc-400 text-right align-top py-3">
                      {formatDate(ticket.created_at)}
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
