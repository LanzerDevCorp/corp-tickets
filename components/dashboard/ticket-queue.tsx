"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getTickets } from "@/app/actions/tickets";
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

export default function TicketQueue({
  initialTickets,
  categories,
  staffUsers,
}: TicketQueueProps) {
  const [status, setStatus] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [assignedTo, setAssignedTo] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const filters = {
    status: status === "all" ? undefined : status,
    priority: priority === "all" ? undefined : priority,
    assigned_to: assignedTo === "all" ? undefined : assignedTo,
    sortOrder,
  };

  const { data: tickets = initialTickets, refetch, isFetching } = useQuery({
    queryKey: ["tickets", filters],
    queryFn: () => getTickets(filters),
    initialData: initialTickets,
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
        <div className="mb-6 flex flex-wrap gap-4 items-center bg-zinc-50/50 p-4 rounded-xl border border-zinc-100 dark:bg-zinc-900/50 dark:border-zinc-900">
          <div className="flex items-center gap-2 text-zinc-500 text-sm">
            <Filter className="h-4 w-4" />
            <span>{t("common.filters")}</span>
          </div>

          {/* Status Filter */}
          <div className="w-[160px]">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="bg-white dark:bg-zinc-900">
                <SelectValue placeholder={t("dashboard.status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("dashboard.allStatuses")}</SelectItem>
                <SelectItem value="open">{statusLabel("open")}</SelectItem>
                <SelectItem value="in_progress">{statusLabel("in_progress")}</SelectItem>
                <SelectItem value="resolved">{statusLabel("resolved")}</SelectItem>
                <SelectItem value="closed">{statusLabel("closed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Priority Filter */}
          <div className="w-[160px]">
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
          <div className="w-[200px]">
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

          {/* Sort Order Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
            title={t("common.toggleSortOrder")}
            className="ml-auto hover:bg-zinc-100 dark:hover:bg-zinc-900"
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
                tickets.map((ticket) => (
                  <TableRow
                    key={ticket.id}
                    className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors"
                  >
                    <TableCell className="font-medium align-top py-3">
                      <TicketSubjectPreview ticket={ticket} />
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
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
