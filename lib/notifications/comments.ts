import { createElement } from "react";
import { render } from "@react-email/components";
import StaffReplyEmail from "@/emails/StaffReplyEmail";
import ClientCommentEmail from "@/emails/ClientCommentEmail";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resend } from "@/lib/resend";
import { formatTicketReference } from "@/lib/tickets/reference";

function dedupeEmails(emails: string[]): string[] {
  return [
    ...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean)),
  ];
}

// Called after a public (non-internal) comment is inserted.
// Sends an email to the ticket submitter (client) informing them of the staff reply.
export async function notifyPublicComment(
  commentId: string,
  ticketId: string,
): Promise<void> {
  try {
    if (!resend) {
      console.error(
        "[notifyPublicComment] Resend client not initialized — RESEND_API_KEY missing",
      );
      return;
    }
    const from = process.env.RESEND_FROM_EMAIL;
    if (!from) {
      console.error("[notifyPublicComment] RESEND_FROM_EMAIL is not set");
      return;
    }

    const { data: row, error } = await supabaseAdmin
      .from("comments")
      .select("body, cc_emails, tickets(id, email, name, subject)")
      .eq("id", commentId)
      .eq("ticket_id", ticketId)
      .single();

    if (error || !row || !row.tickets) {
      console.error(
        "[notifyPublicComment] Failed to fetch comment/ticket data",
        error,
      );
      return;
    }

    const ticket = row.tickets as unknown as {
      id: string;
      email: string;
      name: string;
      subject: string;
    };
    const to = ticket.email;
    const ticketSubject = ticket.subject;
    const clientName = ticket.name;
    const trackingUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/track/${ticket.id}`;
    const ticketReference = formatTicketReference(ticket.id);

    const html = await render(
      createElement(StaffReplyEmail, {
        clientName,
        ticketSubject,
        commentBody: row.body as string,
        ticketReference,
        trackingUrl,
      }),
    );

    const rawCc = dedupeEmails((row.cc_emails as string[]) ?? []).filter(
      (e) => e !== to.toLowerCase(),
    );

    await resend.emails.send({
      from,
      to,
      subject: `Nueva respuesta en tu ticket: "${ticketSubject}"`,
      html,
      ...(rawCc.length ? { cc: rawCc } : {}),
    });
  } catch (err) {
    console.error("[notifyPublicComment]", err);
  }
}

// Called after a client comment is inserted.
// Sends an email to the assigned IT staff member, or all IT+admin users if unassigned.
export async function notifyClientComment(
  commentId: string,
  ticketId: string,
): Promise<void> {
  try {
    if (!resend) {
      console.error(
        "[notifyClientComment] Resend client not initialized — RESEND_API_KEY missing",
      );
      return;
    }
    const from = process.env.RESEND_FROM_EMAIL;
    if (!from) {
      console.error("[notifyClientComment] RESEND_FROM_EMAIL is not set");
      return;
    }

    // Use the explicit FK hint because `ticket_views` also creates a
    // many-to-many path between tickets and users, which would otherwise
    // trigger PostgREST PGRST201 "more than one relationship was found".
    const { data: ticketRow, error: ticketError } = await supabaseAdmin
      .from("tickets")
      .select(
        "id, subject, name, assigned_to, users!tickets_assigned_to_fkey(email, display_name)",
      )
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticketRow) {
      console.error(
        "[notifyClientComment] Failed to fetch ticket data",
        ticketError,
      );
      return;
    }

    const ticket = ticketRow as unknown as {
      id: string;
      subject: string;
      name: string;
      assigned_to: string | null;
      users: { email: string; display_name: string } | null;
    };

    let recipients: string[];

    if (ticket.assigned_to && ticket.users?.email) {
      recipients = [ticket.users.email];
    } else {
      const { data: staffData, error: staffError } = await supabaseAdmin
        .from("users")
        .select("email")
        .in("role", ["admin", "it"]);

      if (staffError) {
        console.error(
          "[notifyClientComment] Failed to fetch staff users",
          staffError,
        );
        return;
      }

      recipients = ((staffData as { email: string }[]) ?? [])
        .map((u) => u.email)
        .filter(Boolean);
    }

    if (recipients.length === 0) {
      console.error("[notifyClientComment] No recipients found — skipping");
      return;
    }

    const { data: commentRow, error: commentError } = await supabaseAdmin
      .from("comments")
      .select("body, cc_emails")
      .eq("id", commentId)
      .eq("ticket_id", ticketId)
      .single();

    if (commentError || !commentRow) {
      console.error(
        "[notifyClientComment] Failed to fetch comment data",
        commentError,
      );
      return;
    }

    const comment = commentRow as { body: string; cc_emails: string[] };
    const ticketSubject = ticket.subject;
    const clientName = ticket.name;
    const trackingUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/track/${ticket.id}`;
    const ticketReference = formatTicketReference(ticket.id);

    const html = await render(
      createElement(ClientCommentEmail, {
        clientName,
        ticketSubject,
        commentBody: comment.body,
        ticketReference,
        trackingUrl,
      }),
    );

    const recipientSet = new Set(recipients.map((e) => e.toLowerCase()));
    const rawCc = dedupeEmails(comment.cc_emails ?? []).filter(
      (e) => !recipientSet.has(e),
    );

    await resend.emails.send({
      from,
      to: recipients,
      subject: `Nuevo comentario del cliente en el ticket: "${ticketSubject}"`,
      html,
      ...(rawCc.length ? { cc: rawCc } : {}),
    });
  } catch (err) {
    console.error("[notifyClientComment]", err);
  }
}
