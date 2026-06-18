/**
 * Notification stubs — Phase 5
 * These are no-op stubs; Phase 6 fills in the bodies without changing signatures.
 */

// Called after a public (non-internal) comment is inserted.
// Phase 6: send an email to the client informing them of the staff reply.
export async function notifyPublicComment(
  _commentId: string,
  _ticketId: string
): Promise<void> {}

// Called after a client comment is inserted.
// Phase 6: send an email to assigned IT staff (or full team if unassigned).
export async function notifyClientComment(
  _commentId: string,
  _ticketId: string
): Promise<void> {}
