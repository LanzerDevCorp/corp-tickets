"use server";

import { getAppRoleFromClaims } from "@/lib/auth/claims";
import { createClient } from "@/lib/supabase/server";
import { provisionClient } from "@/app/actions/client-provision";
import { ticketSubmitSchema } from "@/lib/schemas/ticket-submit";
import { verifyTurnstileToken } from "@/lib/turnstile/verify";
import { notifyNewTicket, notifyTicketCreated, notifyTicketClosed } from "@/lib/notifications/tickets";

export type TicketSubmitResult =
  | { error: null; ticketId: string }
  | { error: string; code?: "turnstile" | "validation" | "db" };

export async function submitTicket(
  _prevState: TicketSubmitResult,
  formData: FormData
): Promise<TicketSubmitResult> {
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    subject: formData.get("subject"),
    body: formData.get("body"),
    priority: formData.get("priority"),
    category_id: formData.get("category_id"),
    turnstile_token: formData.get("turnstile_token"),
  };

  const parsed = ticketSubmitSchema.safeParse(raw);
  if (!parsed.success) {
    const firstError =
      parsed.error.issues[0]?.message ?? "Datos del formulario inválidos";
    return { error: firstError, code: "validation" };
  }

  const { name, email, subject, body, priority, category_id, turnstile_token } =
    parsed.data;

  const turnstileResult = await verifyTurnstileToken(turnstile_token ?? "");
  if (!turnstileResult.success) {
    return { error: turnstileResult.error, code: "turnstile" };
  }

  const supabase = await createClient();

  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert({ name, email, subject, body, category_id, priority })
    .select("id")
    .single();

  if (error || !ticket) {
    console.error("[submitTicket] DB error", error);
    return {
      error: "No pudimos enviar tu ticket. Intenta de nuevo.",
      code: "db",
    };
  }

  const provisionResult = await provisionClient(email, ticket.id);
  if (provisionResult.error) {
    console.error("[provisionClient]", provisionResult.error);
  }

  void notifyNewTicket(ticket.id);

  if (provisionResult.actionLink) {
    void notifyTicketCreated(ticket.id, provisionResult.actionLink);
  }

  return { error: null, ticketId: ticket.id };
}

export async function getTickets(filters: {
  status?: string;
  priority?: string;
  assigned_to?: string;
  sortOrder?: "asc" | "desc";
}) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const role = getAppRoleFromClaims(claimsData?.claims);

  if (role !== "admin" && role !== "it") {
    throw new Error("Not authorized");
  }

  let query = supabase
    .from("tickets")
    .select(`
      *,
      category:categories(name),
      assignee:users!assigned_to(display_name, email)
    `);

  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.priority) {
    query = query.eq("priority", filters.priority);
  }
  if (filters.assigned_to) {
    if (filters.assigned_to === "unassigned") {
      query = query.is("assigned_to", null);
    } else {
      query = query.eq("assigned_to", filters.assigned_to);
    }
  }

  query = query.order("created_at", { ascending: filters.sortOrder === "asc" });

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function getTicketDetail(id: string) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const role = getAppRoleFromClaims(claimsData?.claims);
  const email = claimsData?.claims?.email;

  if (!role) {
    throw new Error("Not authorized");
  }

  // Client view: enforce email matches
  if (role === "client") {
    const { data: ticket, error } = await supabase
      .from("tickets")
      .select(`
        *,
        category:categories(name),
        assignee:users!assigned_to(display_name, email)
      `)
      .eq("id", id)
      .eq("email", email)
      .single();

    if (error || !ticket) {
      throw new Error("Ticket not found or access denied");
    }
    return ticket;
  }

  // Staff view: check for auto-assignment on first open
  const currentUserId = claimsData.claims.sub;

  let { data: ticket } = await supabase
    .from("tickets")
    .update({ assigned_to: currentUserId, status: "in_progress" })
    .eq("id", id)
    .eq("status", "open")
    .is("assigned_to", null)
    .select(`
      *,
      category:categories(name),
      assignee:users!assigned_to(display_name, email)
    `)
    .maybeSingle();

  if (!ticket) {
    const { data, error } = await supabase
      .from("tickets")
      .select(`
        *,
        category:categories(name),
        assignee:users!assigned_to(display_name, email)
      `)
      .eq("id", id)
      .single();

    if (error || !data) {
      throw new Error("Ticket not found");
    }
    ticket = data;
  }

  return ticket;
}

export async function updateTicketStatus(
  id: string,
  status: "open" | "in_progress" | "resolved" | "closed",
  closureReason?: string
) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const role = getAppRoleFromClaims(claimsData?.claims);

  if (role !== "admin" && role !== "it") {
    throw new Error("Not authorized");
  }

  if (status === "closed" && !closureReason) {
    throw new Error("Closure reason is required when status is closed");
  }

  const updatePayload: any = { status };
  if (status === "closed") {
    updatePayload.closure_reason = closureReason;
  } else {
    updatePayload.closure_reason = null;
  }

  const { data, error } = await supabase
    .from("tickets")
    .update(updatePayload)
    .eq("id", id)
    .select(`
      *,
      category:categories(name),
      assignee:users!assigned_to(display_name, email)
    `)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (status === "closed") {
    void notifyTicketClosed(id);
  }

  return data;
}

export async function assignTicket(id: string, assignedTo: string | null) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const role = getAppRoleFromClaims(claimsData?.claims);

  if (role !== "admin" && role !== "it") {
    throw new Error("Not authorized");
  }

  const { data, error } = await supabase
    .from("tickets")
    .update({ assigned_to: assignedTo === "unassigned" ? null : assignedTo })
    .eq("id", id)
    .select(`
      *,
      category:categories(name),
      assignee:users!assigned_to(display_name, email)
    `)
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function getCategories() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const role = getAppRoleFromClaims(claimsData?.claims);

  let query = supabase.from("categories").select("*");

  if (role !== "admin" && role !== "it") {
    query = query.eq("is_enabled", true);
  }

  const { data, error } = await query.order("name", { ascending: true });
  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function getStaffUsers() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const role = getAppRoleFromClaims(claimsData?.claims);

  if (role !== "admin" && role !== "it") {
    throw new Error("Not authorized");
  }

  const { data, error } = await supabase
    .from("users")
    .select("id, email, display_name")
    .in("role", ["admin", "it"])
    .order("display_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}
