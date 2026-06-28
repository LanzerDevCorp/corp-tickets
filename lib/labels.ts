export const STATUS_LABELS = {
  open: "Abierto",
  in_progress: "En progreso",
  resolved: "Resuelto",
  closed: "Cerrado",
} as const;

export type TicketStatus = keyof typeof STATUS_LABELS;

export const PRIORITY_LABELS = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
} as const;

export type TicketPriority = keyof typeof PRIORITY_LABELS;

export const ROLE_LABELS = {
  admin: "Administrador",
  it: "TI",
  client: "Cliente",
} as const;

export type AppRole = keyof typeof ROLE_LABELS;

export function statusLabel(status: string): string {
  return STATUS_LABELS[status as TicketStatus] ?? status.replace("_", " ");
}

export function priorityLabel(priority: string): string {
  return PRIORITY_LABELS[priority as TicketPriority] ?? priority;
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as AppRole] ?? role;
}
