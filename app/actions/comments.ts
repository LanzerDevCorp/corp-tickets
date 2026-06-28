"use server";

import { getAppRoleFromClaims } from "@/lib/auth/claims";
import { createClient } from "@/lib/supabase/server";
import { CommentSubmitSchema } from "@/lib/schemas/comment-submit";
import {
  notifyPublicComment,
  notifyClientComment,
} from "@/lib/notifications/comments";
import { es } from "@/lib/i18n/es";

export type CommentWithAuthor = {
  id: string;
  ticket_id: string;
  author_id: string;
  body: string;
  is_internal: boolean;
  cc_emails: string[];
  created_at: string;
  author: { display_name: string | null; email: string } | null;
};

/**
 * Fetch all comments for a ticket, ordered chronologically ASC.
 * RLS enforces what the caller can see:
 *   - Staff: all comments (public + internal)
 *   - Client: only public comments on their own ticket
 * The same function serves both roles — no branching needed.
 */
export async function getComments(
  ticketId: string,
): Promise<CommentWithAuthor[]> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const role = getAppRoleFromClaims(claimsData?.claims);

  if (!role) {
    throw new Error(es.errors.notAuthorized);
  }

  const { data, error } = await supabase
    .from("comments")
    .select("*, author:users!author_id(display_name, email)")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    throw new Error(error.message);
  }

  return (data as CommentWithAuthor[]) ?? [];
}

/**
 * Add a comment to a ticket.
 * - Validates with CommentSubmitSchema (throws on failure)
 * - Forces is_internal=false for client role (belt-and-suspenders on top of RLS)
 * - Derives author_id from the authenticated session (never caller-supplied)
 * - Fires notification stubs after a successful insert (fire-and-forget)
 */
export async function addComment(input: {
  ticketId: string;
  body: string;
  is_internal: boolean;
  cc_emails?: string[];
}): Promise<CommentWithAuthor> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const role = getAppRoleFromClaims(claimsData?.claims);
  const authorId = claimsData?.claims?.sub;

  if (!role || !authorId) {
    throw new Error(es.errors.notAuthorized);
  }

  const parsed = CommentSubmitSchema.safeParse({
    body: input.body,
    is_internal: input.is_internal,
    cc_emails: input.cc_emails,
  });

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? es.validation.invalidCommentData,
    );
  }

  // Belt-and-suspenders: client callers can never post internal comments
  const isInternal = role === "client" ? false : parsed.data.is_internal;

  const { data, error } = await supabase
    .from("comments")
    .insert({
      ticket_id: input.ticketId,
      author_id: authorId,
      body: parsed.data.body,
      is_internal: isInternal,
      cc_emails: parsed.data.cc_emails,
    })
    .select("*, author:users!author_id(display_name, email)")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // Fire-and-forget notifications — do not block the user response
  if (role === "client") {
    void notifyClientComment(data.id, input.ticketId);
    // Client comments are always public (is_internal=false), so also notify staff
    void notifyPublicComment(data.id, input.ticketId);
  } else if (isInternal === false) {
    // Staff posted a public reply
    void notifyPublicComment(data.id, input.ticketId);
  }
  // Staff internal note: no notification

  return data as CommentWithAuthor;
}
