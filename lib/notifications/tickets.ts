import { createElement } from "react";
import { render } from "@react-email/components";
import NewTicketEmail from "@/emails/NewTicketEmail";
import TicketCreatedEmail from "@/emails/TicketCreatedEmail";
import TicketClosedEmail from "@/emails/TicketClosedEmail";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resend } from "@/lib/resend";

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

    const ticket = ticketRow as {
      name: string;
      email: string;
      subject: string;
      priority: string;
      body: string;
      categories: { name: string } | null;
    };

    const categoryName =
      (ticket.categories as { name: string } | null)?.name ?? "Uncategorized";

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
    await resend.emails.send({
      from,
      to: recipients,
      subject: `New ticket: "${ticket.subject}"`,
      html,
    });
  } catch (err) {
    console.error("[notifyNewTicket]", err);
  }
}

export async function notifyTicketCreated(
  ticketId: string,
  magicLinkUrl: string
): Promise<void> {
  try {
    if (!resend) {
      console.error(
        "[notifyTicketCreated] Resend client not initialized — RESEND_API_KEY missing"
      );
      return;
    }
    const from = process.env.RESEND_FROM_EMAIL;
    if (!from) {
      console.error("[notifyTicketCreated] RESEND_FROM_EMAIL is not set");
      return;
    }

    if (!magicLinkUrl) {
      console.error("[notifyTicketCreated] magicLinkUrl is empty — skipping");
      return;
    }

    const { data: ticketRow, error: ticketError } = await supabaseAdmin
      .from("tickets")
      .select("name, email, subject, priority, categories(name)")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticketRow) {
      console.error(
        "[notifyTicketCreated] Failed to fetch ticket data",
        ticketError
      );
      return;
    }

    const ticket = ticketRow as unknown as {
      name: string;
      email: string;
      subject: string;
      priority: string;
      categories: { name: string } | null;
    };

    const categoryName =
      (ticket.categories as { name: string } | null)?.name ?? "Uncategorized";

    const html = await render(
      createElement(TicketCreatedEmail, {
        clientName: ticket.name,
        ticketSubject: ticket.subject,
        priority: ticket.priority as "low" | "medium" | "high" | "urgent",
        categoryName,
        magicLinkUrl,
      })
    );

    await resend.emails.send({
      from,
      to: ticket.email,
      subject: `Ticket received: "${ticket.subject}"`,
      html,
    });
  } catch (err) {
    console.error("[notifyTicketCreated]", err);
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

    await resend.emails.send({
      from,
      to: ticket.email,
      subject: `Ticket closed: "${ticket.subject}"`,
      html,
    });
  } catch (err) {
    console.error("[notifyTicketClosed]", err);
  }
}
