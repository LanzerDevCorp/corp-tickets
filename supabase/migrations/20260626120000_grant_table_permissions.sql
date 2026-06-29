-- Grant table-level permissions to authenticated, anon, and service_role.
-- RLS policies handle row-level filtering — these grants are the prerequisite
-- layer that allows Postgres to even evaluate those policies.
-- Without these, any query returns "permission denied" before RLS runs.
-- Note: Supabase cloud applies these automatically; local does not.

-- tickets
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO service_role;
GRANT INSERT ON public.tickets TO anon;

-- categories
GRANT SELECT ON public.categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO service_role;

-- comments
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO service_role;

-- ticket_attachments
GRANT SELECT, INSERT, DELETE ON public.ticket_attachments TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.ticket_attachments TO service_role;
GRANT SELECT, INSERT ON public.ticket_attachments TO anon;

-- users
GRANT SELECT ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO service_role;
