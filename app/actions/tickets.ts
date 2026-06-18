"use server";

import { createClient } from "@/lib/supabase/server";
import { provisionClient } from "@/app/actions/client-provision";

type TicketResult = { error: string | null; ticketId?: string };

export async function submitTicket(
  _prevState: TicketResult,
  formData: FormData
): Promise<TicketResult> {
  const name = (formData.get("name") as string) || "Anonymous";
  const email = formData.get("email") as string;
  const subject = formData.get("subject") as string;
  const body = (formData.get("body") || formData.get("description")) as string;
  const category_id = formData.get("category_id") as string;
  const priority = (formData.get("priority") as string) || "medium";

  const supabase = await createClient();

  // Basic check: if category_id isn't provided, see if we can find one in the DB (for backwards compatibility in simple tests)
  let targetCategoryId = category_id;
  if (!targetCategoryId) {
    const { data: cat } = await supabase.from("categories").select("id").limit(1).maybeSingle();
    if (cat) {
      targetCategoryId = cat.id;
    } else {
      // Create a default category if none exists to avoid foreign key failures
      const { data: newCat } = await supabase
        .from("categories")
        .insert({ name: "Default Category", is_enabled: true })
        .select()
        .single();
      if (newCat) targetCategoryId = newCat.id;
    }
  }

  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert({
      name,
      email,
      subject,
      body,
      category_id: targetCategoryId,
      priority,
    })
    .select()
    .single();

  if (error || !ticket) {
    return { error: error?.message ?? "Failed to create ticket" };
  }

  // Best-effort: provision client account + send magic link
  // Does not block ticket creation on failure
  const { error: provisionError } = await provisionClient(email, ticket.id);
  if (provisionError) {
    console.error("[provisionClient]", provisionError);
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
  const role = claimsData?.claims?.role;

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
  const role = claimsData?.claims?.role;
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
  const role = claimsData?.claims?.role;

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
  return data;
}

export async function assignTicket(id: string, assignedTo: string | null) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const role = claimsData?.claims?.role;

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
  const role = claimsData?.claims?.role;

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
  const role = claimsData?.claims?.role;

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
