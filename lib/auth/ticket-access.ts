import { createHmac, timingSafeEqual } from "crypto";

function ticketAccessSecret(): string {
  return (
    process.env.TICKET_ACCESS_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    ""
  );
}

export function signTicketAccess(ticketId: string, email: string): string {
  const secret = ticketAccessSecret();
  if (!secret) {
    throw new Error("Missing TICKET_ACCESS_SECRET or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createHmac("sha256", secret)
    .update(`${ticketId}|${email.toLowerCase()}`)
    .digest("hex");
}

export function verifyTicketAccess(
  ticketId: string,
  email: string,
  signature: string
): boolean {
  if (!signature) return false;

  try {
    const expected = signTicketAccess(ticketId, email);
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signature, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function buildTicketAccessUrl(ticketId: string, email: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const sig = signTicketAccess(ticketId, email);
  return `${siteUrl}/auth/ticket-access?ticket=${encodeURIComponent(ticketId)}&sig=${encodeURIComponent(sig)}`;
}
