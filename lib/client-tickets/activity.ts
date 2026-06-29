type TicketActivityInput = {
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

type CommentActivityInput = {
  author_id: string;
  is_internal: boolean;
  created_at: string;
};

type AttachmentActivityInput = {
  created_at: string;
  deleted_at: string | null;
  /** Staff actor id, or null for client/anon uploads (e.g. at ticket creation). */
  uploaded_by: string | null;
};

function maxTimestamp(timestamps: string[]): string | null {
  if (timestamps.length === 0) return null;
  return timestamps.reduce((latest, current) =>
    current > latest ? current : latest,
  );
}

export function computeStaffActivityAt(
  ticket: TicketActivityInput,
  comments: CommentActivityInput[],
  attachments: AttachmentActivityInput[],
  clientUserId: string,
): string | null {
  const candidates: string[] = [];

  for (const comment of comments) {
    if (!comment.is_internal && comment.author_id !== clientUserId) {
      candidates.push(comment.created_at);
    }
  }

  for (const attachment of attachments) {
    // Only staff-uploaded, still-active attachments count as new activity.
    // Client/anon uploads (uploaded_by null) and the client's own uploads must
    // not trigger the badge.
    if (
      !attachment.deleted_at &&
      attachment.uploaded_by &&
      attachment.uploaded_by !== clientUserId
    ) {
      candidates.push(attachment.created_at);
    }
  }

  if (ticket.resolved_at) {
    candidates.push(ticket.resolved_at);
  }

  if (ticket.updated_at !== ticket.created_at) {
    candidates.push(ticket.updated_at);
  }

  return maxTimestamp(candidates);
}

export function computeHasNewActivity(
  lastViewedAt: string | null,
  staffActivityAt: string | null,
): boolean {
  if (!staffActivityAt) return false;
  if (!lastViewedAt) return true;
  return staffActivityAt > lastViewedAt;
}
