const SHORT_REF_PATTERN = /^[0-9a-f]{8}$/i;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function formatTicketReference(ticketId: string): string {
  return ticketId.slice(0, 8).toUpperCase();
}

export function normalizeTicketReferenceInput(input: string): string {
  return input.trim().replace(/^#/, "").toLowerCase();
}

export function isValidTicketReferenceInput(input: string): boolean {
  const normalized = normalizeTicketReferenceInput(input);
  return SHORT_REF_PATTERN.test(normalized) || UUID_PATTERN.test(normalized);
}

export function ticketMatchesReference(
  ticketId: string,
  referenceInput: string,
): boolean {
  const ref = normalizeTicketReferenceInput(referenceInput);
  if (!ref) return false;

  const idLower = ticketId.toLowerCase();
  if (UUID_PATTERN.test(ref)) {
    return idLower === ref;
  }

  const idHex = idLower.replace(/-/g, "");
  return idHex.startsWith(ref);
}
