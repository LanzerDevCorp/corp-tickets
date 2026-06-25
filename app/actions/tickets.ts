"use server";

import { getAppRoleFromClaims } from "@/lib/auth/claims";
import { getAuthenticatedEmail } from "@/lib/auth/session-email";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { provisionClient } from "@/app/actions/client-provision";
import { ticketSubmitSchema } from "@/lib/schemas/ticket-submit";
import { verifyTurnstileToken } from "@/lib/turnstile/verify";
import { notifyNewTicket, notifyTicketCreated, notifyTicketClosed } from "@/lib/notifications/tickets";
import { es } from "@/lib/i18n/es";

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
    turnstile_token: formData.get("turnstile_token") ?? undefined,
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

  const { data: ticket, error } = await supabaseAdmin
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
  console.log("[submitTicket] provision result", {
    error: provisionResult.error,
    hasActionLink: !!provisionResult.actionLink,
    alreadyExisted: provisionResult.alreadyExisted,
  });

  await Promise.all([
    notifyNewTicket(ticket.id),
    provisionResult.actionLink
      ? notifyTicketCreated(ticket.id, provisionResult.actionLink)
      : Promise.resolve(
          console.error(
            "[submitTicket] actionLink missing — client email NOT sent. provisionError:",
            provisionResult.error
          )
        ),
  ]);

  return { error: null, ticketId: ticket.id };
}

export async function getTickets(filters: {
  statuses?: string[];
  priority?: string;
  assigned_to?: string;
  sortOrder?: "asc" | "desc";
}) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const role = getAppRoleFromClaims(claimsData?.claims);

  if (role !== "admin" && role !== "it") {
    throw new Error(es.errors.notAuthorized);
  }

  let query = supabase
    .from("tickets")
    .select(`
      *,
      category:categories(name),
      assignee:users!assigned_to(display_name, email)
    `);

  const activeStatuses = filters.statuses?.filter((s) => s !== "all");
  if (activeStatuses && activeStatuses.length > 0) {
    query = query.in("status", activeStatuses);
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
  const claims = claimsData?.claims;
  const userId = claims?.sub as string | undefined;

  if (!userId) {
    throw new Error(es.errors.notAuthorized);
  }

  const role = getAppRoleFromClaims(claims);

  // Client view: enforce email matches
  if (role === "client") {
    const email = await getAuthenticatedEmail(supabase, claims);
    if (!email) {
      throw new Error(es.errors.notAuthorized);
    }

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
      throw new Error(es.errors.ticketNotFoundOrDenied);
    }
    return ticket;
  }

  // Staff view: check for auto-assignment on first open
  const currentUserId = userId;

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
      throw new Error(es.errors.ticketNotFound);
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
    throw new Error(es.errors.notAuthorized);
  }

  if (status === "closed" && !closureReason) {
    throw new Error(es.errors.closureReasonRequired);
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
    throw new Error(es.errors.notAuthorized);
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

export async function updateTicketCategory(id: string, categoryId: string) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const role = getAppRoleFromClaims(claimsData?.claims);

  if (role !== "admin" && role !== "it") {
    throw new Error(es.errors.notAuthorized);
  }

  const { data, error } = await supabase
    .from("tickets")
    .update({ category_id: categoryId })
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
    throw new Error(es.errors.notAuthorized);
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
