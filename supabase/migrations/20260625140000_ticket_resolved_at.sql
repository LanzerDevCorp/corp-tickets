-- Migration: ticket-resolved-at
-- Adds resolved_at column, a BEFORE UPDATE trigger that sets it on transition
-- TO 'resolved' and clears it on transition OUT OF 'resolved',
-- backfills existing resolved rows, and creates an index.
-- All statements are idempotent / safe to re-apply.
-- Mirrors the pattern from 20260625130000_realtime_ticket_queue.sql.

-- 1. Add resolved_at column. NULL = ticket has never been resolved (or was re-opened).
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- 2. Backfill: existing resolved tickets get resolved_at = updated_at
--    (best-effort proxy; exact timestamps begin once the trigger is live).
--    Runs BEFORE the trigger is attached so the function does not fire here.
UPDATE public.tickets
  SET resolved_at = updated_at
  WHERE status = 'resolved';

-- 3. Trigger function: two branches —
--      TO resolved   → set now()
--      OUT of resolved → clear to NULL
CREATE OR REPLACE FUNCTION public.set_resolved_at_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'resolved' AND OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.resolved_at := now();
  ELSIF OLD.status = 'resolved' AND NEW.status <> 'resolved' THEN
    NEW.resolved_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Attach trigger (drop first for idempotency).
DROP TRIGGER IF EXISTS set_resolved_at_on_status_change ON public.tickets;
CREATE TRIGGER set_resolved_at_on_status_change
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_resolved_at_on_status_change();

-- 5. Index for future SLA / analytics queries on resolved_at.
CREATE INDEX IF NOT EXISTS idx_tickets_resolved_at ON public.tickets(resolved_at);
