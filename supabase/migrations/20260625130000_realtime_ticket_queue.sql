-- Migration: realtime-ticket-queue
-- Adds first_seen_at column, reset-on-reopen trigger, REPLICA IDENTITY FULL,
-- and enrolls public.tickets in the supabase_realtime publication.
-- All statements are idempotent / safe to re-apply.

-- 1. Add first_seen_at column. NULL = "new / not yet seen by any staff member".
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ;

-- 2. Trigger function: reset first_seen_at when ticket is re-opened.
--    Only fires on an actual status transition TO 'open'.
CREATE OR REPLACE FUNCTION public.reset_first_seen_on_reopen()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'open' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.first_seen_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Attach trigger (drop first for idempotency).
DROP TRIGGER IF EXISTS reset_first_seen_on_reopen ON public.tickets;
CREATE TRIGGER reset_first_seen_on_reopen
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_first_seen_on_reopen();

-- 4. Full row image on UPDATE so Realtime payloads carry complete row data.
ALTER TABLE public.tickets REPLICA IDENTITY FULL;

-- 5. Add tickets to the Realtime publication (guard avoids duplicate-add error).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'tickets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
  END IF;
END $$;
