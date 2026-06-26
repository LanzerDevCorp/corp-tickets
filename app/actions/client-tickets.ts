"use server";

import { getAppRoleFromClaims } from "@/lib/auth/claims";
import { getAuthenticatedEmail } from "@/lib/auth/session-email";
import { createClient } from "@/lib/supabase/server";
import {
  computeHasNewActivity,
  computeStaffActivityAt,
} from "@/lib/client-tickets/activity";
import { es } from "@/lib/i18n/es";

export type ClientTicketListItem = {
  id: string;
  subject: string;
  status: string;
  created_at: string;
  hasNewActivity: boolean;
};

type TicketRow = {
  id: string;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

type TicketViewRow = {
  ticket_id: string;
  last_viewed_at: string;
};

type CommentRow = {
  ticket_id: string;
  author_id: string;
  is_internal: boolean;
  created_at: string;
};

type AttachmentRow = {
  ticket_id: string;
  created_at: string;
  deleted_at: string | null;
  uploaded_by: string | null;
};

async function requireClientSession() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const userId = claims?.sub as string | undefined;

  if (!userId) {
    throw new Error(es.errors.notAuthorized);
  }

  const role = getAppRoleFromClaims(claims);
  if (role !== "client") {
    throw new Error(es.errors.notAuthorized);
  }

  const email = await getAuthenticatedEmail(supabase, claims);
  if (!email) {
    throw new Error(es.errors.notAuthorized);
  }

  return { supabase, userId, email };
}

export async function getClientTickets(): Promise<ClientTicketListItem[]> {
  const { supabase, userId, email } = await requireClientSession();

  const { data: tickets, error: ticketsError } = await supabase
    .from("tickets")
    .select("id, subject, status, created_at, updated_at, resolved_at")
    .eq("email", email)
    .order("created_at", { ascending: false });

  if (ticketsError) {
    throw new Error(ticketsError.message);
  }

  const ticketRows = (tickets ?? []) as TicketRow[];
  if (ticketRows.length === 0) {
    return [];
  }

  const ticketIds = ticketRows.map((t) => t.id);

  const [viewsResult, commentsResult, attachmentsResult] = await Promise.all([
    supabase
      .from("ticket_views")
      .select("ticket_id, last_viewed_at")
      .eq("user_id", userId)
      .in("ticket_id", ticketIds),
    supabase
      .from("comments")
      .select("ticket_id, author_id, is_internal, created_at")
      .in("ticket_id", ticketIds)
      .eq("is_internal", false),
    supabase
      .from("ticket_attachments")
      .select("ticket_id, created_at, deleted_at, uploaded_by")
      .in("ticket_id", ticketIds),
  ]);

  if (viewsResult.error) {
    throw new Error(viewsResult.error.message);
  }
  if (commentsResult.error) {
    throw new Error(commentsResult.error.message);
  }
  if (attachmentsResult.error) {
    throw new Error(attachmentsResult.error.message);
  }

  const viewsByTicket = new Map<string, string>();
  for (const view of (viewsResult.data ?? []) as TicketViewRow[]) {
    viewsByTicket.set(view.ticket_id, view.last_viewed_at);
  }

  const commentsByTicket = new Map<string, CommentRow[]>();
  for (const comment of (commentsResult.data ?? []) as CommentRow[]) {
    const list = commentsByTicket.get(comment.ticket_id) ?? [];
    list.push(comment);
    commentsByTicket.set(comment.ticket_id, list);
  }

  const attachmentsByTicket = new Map<string, AttachmentRow[]>();
  for (const attachment of (attachmentsResult.data ?? []) as AttachmentRow[]) {
    const list = attachmentsByTicket.get(attachment.ticket_id) ?? [];
    list.push(attachment);
    attachmentsByTicket.set(attachment.ticket_id, list);
  }

  return ticketRows.map((ticket) => {
    const staffActivityAt = computeStaffActivityAt(
      ticket,
      commentsByTicket.get(ticket.id) ?? [],
      attachmentsByTicket.get(ticket.id) ?? [],
      userId
    );
    const lastViewedAt = viewsByTicket.get(ticket.id) ?? null;

    return {
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      created_at: ticket.created_at,
      hasNewActivity: computeHasNewActivity(lastViewedAt, staffActivityAt),
    };
  });
}

export async function markTicketViewed(ticketId: string): Promise<void> {
  const { supabase, userId } = await requireClientSession();

  const { error } = await supabase.from("ticket_views").upsert(
    {
      user_id: userId,
      ticket_id: ticketId,
      last_viewed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,ticket_id" }
  );

  if (error) {
    throw new Error(error.message);
  }
}
