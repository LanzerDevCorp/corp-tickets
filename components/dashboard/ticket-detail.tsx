"use client";

import { useState } from "react";
import { updateTicketStatus, assignTicket } from "@/app/actions/tickets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, User, Calendar, AlertCircle } from "lucide-react";
import Link from "next/link";
import CommentThread from "@/components/dashboard/comment-thread";
import CommentForm from "@/components/dashboard/comment-form";
import { type CommentWithAuthor } from "@/app/actions/comments";

type TicketDetailProps = {
  initialTicket: any;
  staffUsers: any[];
  initialComments: CommentWithAuthor[];
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

export default function TicketDetail({
  initialTicket,
  staffUsers,
  initialComments,
}: TicketDetailProps) {
  const [ticket, setTicket] = useState(initialTicket);
  const [comments, setComments] = useState<CommentWithAuthor[]>(initialComments);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Dialog state for closure reason
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [closureReason, setClosureReason] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === "closed") {
      setClosureReason("");
      setDialogError(null);
      setIsDialogOpen(true);
      return;
    }

    try {
      setIsUpdating(true);
      setErrorMsg(null);
      const updated = await updateTicketStatus(ticket.id, newStatus as any);
      setTicket(updated);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update status");
    } finally {
      setIsUpdating(false);
    }
  };

  const submitClosure = async () => {
    if (!closureReason.trim()) {
      setDialogError("Please provide a reason for closing the ticket");
      return;
    }

    try {
      setIsUpdating(true);
      setDialogError(null);
      setIsDialogOpen(false);
      const updated = await updateTicketStatus(ticket.id, "closed", closureReason);
      setTicket(updated);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to close ticket");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAssigneeChange = async (newAssigneeId: string) => {
    try {
      setIsUpdating(true);
      setErrorMsg(null);
      const val = newAssigneeId === "unassigned" ? null : newAssigneeId;
      const updated = await assignTicket(ticket.id, val);
      setTicket(updated);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to assign ticket");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Back button */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild className="gap-2">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
            Back to Queue
          </Link>
        </Button>
        {isUpdating && (
          <span className="text-sm text-zinc-400 animate-pulse">Saving changes...</span>
        )}
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 p-4 text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-xl">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{errorMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-zinc-200 bg-white/50 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/50">
            <CardHeader className="border-b border-zinc-100 pb-6 dark:border-zinc-900">
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge variant="outline" className={`${STATUS_COLORS[ticket.status]} uppercase tracking-wider text-[10px] px-2.5 py-0.5`}>
                  {ticket.status.replace("_", " ")}
                </Badge>
                <Badge variant="outline" className={`${PRIORITY_COLORS[ticket.priority]} uppercase tracking-wider text-[10px] px-2.5 py-0.5`}>
                  {ticket.priority}
                </Badge>
                <Badge variant="secondary" className="bg-zinc-100 text-zinc-700 uppercase tracking-wider text-[10px] dark:bg-zinc-900 dark:text-zinc-300">
                  {ticket.category?.name || "General"}
                </Badge>
              </div>
              <CardTitle className="text-2xl font-bold text-zinc-950 dark:text-zinc-50">
                {ticket.subject}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-2">
                <span>Submitted by: <strong>{ticket.name}</strong> ({ticket.email})</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="prose prose-zinc max-w-none dark:prose-invert">
                <h3 className="text-sm font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Description</h3>
                <p className="text-zinc-800 dark:text-zinc-200 whitespace-pre-line leading-relaxed">
                  {ticket.body || ticket.description}
                </p>
              </div>

              {ticket.status === "closed" && ticket.closure_reason && (
                <div className="mt-8 p-4 rounded-xl border border-rose-500/20 bg-rose-500/5">
                  <h4 className="text-sm font-semibold text-rose-500 uppercase tracking-wider mb-1">Closure Reason</h4>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 italic">{ticket.closure_reason}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Comment thread + form */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
              Comments
            </h3>
            <CommentThread comments={comments} />
            <CommentForm
              ticketId={ticket.id}
              onPosted={(c) => setComments((prev) => [...prev, c])}
            />
          </div>
        </div>

        {/* Sidebar Controls */}
        <div className="space-y-6">
          <Card className="border-zinc-200 bg-white/50 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/50">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Status Selector */}
              <div className="space-y-2">
                <Label htmlFor="status" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Ticket Status</Label>
                <Select
                  value={ticket.status}
                  onValueChange={handleStatusChange}
                  disabled={isUpdating}
                >
                  <SelectTrigger id="status" className="bg-white dark:bg-zinc-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Assignee Selector */}
              <div className="space-y-2">
                <Label htmlFor="assignee" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Assigned Staff</Label>
                <Select
                  value={ticket.assigned_to || "unassigned"}
                  onValueChange={handleAssigneeChange}
                  disabled={isUpdating}
                >
                  <SelectTrigger id="assignee" className="bg-white dark:bg-zinc-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {staffUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.display_name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sidebar Info Summary */}
              <div className="pt-4 border-t border-zinc-100 space-y-3 text-xs text-zinc-500 dark:border-zinc-900">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Created:</span>
                  <span className="font-medium">{new Date(ticket.created_at).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Assignee:</span>
                  <span className="font-medium">
                    {ticket.assignee?.display_name || ticket.assignee?.email || "Unassigned"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Closure Reason Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Provide Closure Reason</DialogTitle>
            <DialogDescription>
              Please explain why this ticket is being closed without resolution. This reason will be visible to the client.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Closure Reason</Label>
              <Textarea
                id="reason"
                value={closureReason}
                onChange={(e) => setClosureReason(e.target.value)}
                placeholder="e.g. Duplicate ticket, out of scope, or client withdrew request."
                className="min-h-[100px]"
              />
              {dialogError && (
                <p className="text-xs text-rose-500">{dialogError}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isUpdating}>
              Cancel
            </Button>
            <Button onClick={submitClosure} disabled={isUpdating}>
              Confirm Closure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
