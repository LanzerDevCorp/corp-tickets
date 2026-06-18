-- Migration: add_is_active_to_users
-- Adds soft-deactivation support to public.users.
-- DEFAULT true ensures all existing rows remain active (zero-downtime).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Partial index -- accelerates notifyNewTicket recipient query: .eq("is_active", true)
CREATE INDEX IF NOT EXISTS idx_users_is_active
  ON public.users(is_active);

-- Supports role-based queries: .in("role", ["admin", "it"])
CREATE INDEX IF NOT EXISTS idx_users_role
  ON public.users(role);
