import { createElement } from "react";
import { render } from "@react-email/components";
import NewTicketEmail from "@/emails/NewTicketEmail";
import TicketCreatedEmail from "@/emails/TicketCreatedEmail";
import TicketClosedEmail from "@/emails/TicketClosedEmail";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resend } from "@/lib/resend";
import { buildTicketAccessUrl } from "@/lib/auth/ticket-access";
import { formatTicketReference } from "@/lib/tickets/reference";
import { t } from "@/lib/i18n/t";
import { es } from "@/lib/i18n/es";

type TicketAccessRow = {
  id: string;
  name: string;
  email: string;
  subject: string;
  priority: string;
  categories: { name: string }[] | { name: string } | null;
};

function categoryNameFromTicket(ticket: TicketAccessRow): string {
  const rawCat = ticket.categories;
  if (Array.isArray(rawCat)) {
    return rawCat[0]?.name ?? es.common.uncategorized;
  }
  return rawCat?.name ?? es.common.uncategorized;
}

export async function sendTicketAccessEmail(
  ticketId: string,
  magicLinkUrl?: string
): Promise<{ error: string | null }> {
  if (!resend) {
    console.error("[sendTicketAccessEmail] Resend client not initialized");
    return { error: es.errors.magicLinkSendFailed };
  }

  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    console.error("[sendTicketAccessEmail] RESEND_FROM_EMAIL is not set");
    return { error: es.errors.magicLinkSendFailed };
  }

  const { data: ticketRow, error: ticketError } = await supabaseAdmin
    .from("tickets")
    .select("id, name, email, subject, priority, categories(name)")
    .eq("id", ticketId)
    .single();

  if (ticketError || !ticketRow) {
    console.error("[sendTicketAccessEmail] Failed to fetch ticket", ticketError);
    return { error: es.errors.ticketNotFound };
  }

  const ticket = ticketRow as TicketAccessRow;

  let accessUrl = magicLinkUrl;
  if (!accessUrl) {
    try {
      accessUrl = buildTicketAccessUrl(ticket.id, ticket.email);
    } catch (err) {
      console.error("[sendTicketAccessEmail] Failed to build access URL", err);
      return { error: es.errors.magicLinkSendFailed };
    }
  }

  try {
    const html = await render(
      createElement(TicketCreatedEmail, {
        clientName: ticket.name,
        ticketSubject: ticket.subject,
        ticketReference: formatTicketReference(ticket.id),
        priority: ticket.priority as "low" | "medium" | "high" | "urgent",
        categoryName: categoryNameFromTicket(ticket),
        magicLinkUrl: accessUrl,
      })
    );

    const { error: sendError } = await resend.emails.send({
      from,
      to: ticket.email,
      subject: t("email.subjects.ticketCreated", { subject: ticket.subject }),
      html,
    });

    if (sendError) {
      console.error("[sendTicketAccessEmail] Resend send error", sendError);
      return { error: es.errors.magicLinkSendFailed };
    }

    return { error: null };
  } catch (err) {
    console.error("[sendTicketAccessEmail]", err);
    return { error: es.errors.magicLinkSendFailed };
  }
}

export async function notifyNewTicket(ticketId: string): Promise<void> {
  try {
    if (!resend) {
      console.error(
        "[notifyNewTicket] Resend client not initialized — RESEND_API_KEY missing"
      );
      return;
    }
    const from = process.env.RESEND_FROM_EMAIL;
    if (!from) {
      console.error("[notifyNewTicket] RESEND_FROM_EMAIL is not set");
      return;
    }

    // 1. Fetch ticket + category join
    const { data: ticketRow, error: ticketError } = await supabaseAdmin
      .from("tickets")
      .select("name, email, subject, priority, body, categories(name)")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticketRow) {
      console.error(
        "[notifyNewTicket] Failed to fetch ticket data",
        ticketError
      );
      return;
    }

    // 2. Fetch active admin + IT staff
    const { data: staffData, error: staffError } = await supabaseAdmin
      .from("users")
      .select("email")
      .in("role", ["admin", "it"])
      .eq("is_active", true);

    if (staffError) {
      console.error(
        "[notifyNewTicket] Failed to fetch staff users",
        staffError
      );
      return;
    }

    const recipients = ((staffData ?? []) as { email: string }[])
      .map((u) => u.email)
      .filter(Boolean);

    if (recipients.length === 0) {
      console.error("[notifyNewTicket] No recipients found — skipping");
      return;
    }

    const ticket = ticketRow as unknown as {
      name: string;
      email: string;
      subject: string;
      priority: string;
      body: string;
      categories: { name: string }[] | { name: string } | null;
    };

    const rawCat = ticket.categories;
    const categoryName = Array.isArray(rawCat)
      ? (rawCat[0]?.name ?? es.common.uncategorized)
      : (rawCat?.name ?? es.common.uncategorized);

    // 3. Render email
    const html = await render(
      createElement(NewTicketEmail, {
        ticketId,
        submitterName: ticket.name,
        submitterEmail: ticket.email,
        subject: ticket.subject,
        priority: ticket.priority as "low" | "medium" | "high" | "urgent",
        categoryName,
        body: ticket.body,
        dashboardUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/dashboard`,
      })
    );

    // 4. Send
    const { error: sendError } = await resend.emails.send({
      from,
      to: recipients,
      subject: t("email.subjects.newTicket", { subject: ticket.subject }),
      html,
    });
    if (sendError) {
      console.error("[notifyNewTicket] Resend send error", sendError);
    }
  } catch (err) {
    console.error("[notifyNewTicket]", err);
  }
}

export async function notifyTicketCreated(
  ticketId: string,
  magicLinkUrl: string
): Promise<void> {
  if (!magicLinkUrl) {
    console.error("[notifyTicketCreated] magicLinkUrl is empty — skipping");
    return;
  }

  const result = await sendTicketAccessEmail(ticketId, magicLinkUrl);
  if (result.error) {
    console.error("[notifyTicketCreated]", result.error);
  }
}

export async function notifyTicketClosed(ticketId: string): Promise<void> {
  try {
    if (!resend) {
      console.error(
        "[notifyTicketClosed] Resend client not initialized — RESEND_API_KEY missing"
      );
      return;
    }
    const from = process.env.RESEND_FROM_EMAIL;
    if (!from) {
      console.error("[notifyTicketClosed] RESEND_FROM_EMAIL is not set");
      return;
    }

    const { data: ticketRow, error: ticketError } = await supabaseAdmin
      .from("tickets")
      .select("name, email, subject, closure_reason")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticketRow) {
      console.error(
        "[notifyTicketClosed] Failed to fetch ticket data",
        ticketError
      );
      return;
    }

    const ticket = ticketRow as {
      name: string;
      email: string;
      subject: string;
      closure_reason: string | null;
    };

    if (!ticket.closure_reason) {
      console.error(
        "[notifyTicketClosed] closure_reason missing — skipping"
      );
      return;
    }

    const trackingUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/track/${ticketId}`;

    const html = await render(
      createElement(TicketClosedEmail, {
        clientName: ticket.name,
        ticketSubject: ticket.subject,
        closureReason: ticket.closure_reason,
        trackingUrl,
      })
    );

    const { error: sendError } = await resend.emails.send({
      from,
      to: ticket.email,
      subject: t("email.subjects.ticketClosed", { subject: ticket.subject }),
      html,
    });
    if (sendError) {
      console.error("[notifyTicketClosed] Resend send error", sendError);
    }
  } catch (err) {
    console.error("[notifyTicketClosed]", err);
  }
}
