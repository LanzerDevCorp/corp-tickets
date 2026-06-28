import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** Service-role client for test data setup/inspection (bypasses RLS). */
export function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** True when local Supabase env is loaded; specs skip their setup otherwise. */
export const hasSupabaseEnv = Boolean(SUPABASE_URL && SERVICE_KEY);

export type TicketData = {
  name: string;
  email: string;
  subject: string;
  body: string;
  /** Visible priority radio label, e.g. "Alta". */
  priority: string;
  /** Visible category option label, e.g. "Soporte técnico". */
  category: string;
  /** Unique-per-run marker embedded in the subject. */
  marker: string;
};

/** Build ticket data with a collision-free subject marker for deterministic asserts. */
export function makeTicket(overrides: Partial<TicketData> = {}): TicketData {
  const marker = `E2E-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
  return {
    name: "María García",
    email: "maria@empresa.mx",
    subject: `No puedo acceder al sistema ${marker}`,
    body: "Desde esta mañana no puedo iniciar sesión. Restablecí la contraseña y sigue sin funcionar.",
    priority: "Alta",
    category: "Soporte técnico",
    marker,
    ...overrides,
  };
}

/** Ensure an enabled category exists so the public form can render (idempotent). */
export async function ensureCategory(name = "Soporte técnico") {
  const { error } = await adminClient()
    .from("categories")
    .upsert({ name, is_enabled: true }, { onConflict: "name" });
  if (error) throw error;
}

/** Resolve a ticket's UUID by its unique subject — used to open its detail page. */
export async function getTicketIdBySubject(subject: string): Promise<string> {
  const { data, error } = await adminClient()
    .from("tickets")
    .select("id")
    .eq("subject", subject)
    .single();
  if (error || !data) {
    throw new Error(`Ticket not found for subject: ${subject}`);
  }
  return data.id;
}
