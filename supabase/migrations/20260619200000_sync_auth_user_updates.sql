-- Sync public.users when auth.users metadata or email changes (e.g. post-invite role set).
-- Fixes staff invites defaulting to role=client because app_metadata is set after INSERT.

CREATE OR REPLACE FUNCTION public.handle_auth_user_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET
    role = COALESCE(NEW.raw_app_meta_data->>'role', role),
    email = NEW.email,
    display_name = COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      display_name
    )
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_updated();

-- Backfill roles from auth app_metadata for rows created before metadata was set.
UPDATE public.users AS u
SET role = au.raw_app_meta_data->>'role'
FROM auth.users AS au
WHERE u.id = au.id
  AND au.raw_app_meta_data->>'role' IN ('admin', 'it', 'client')
  AND u.role IS DISTINCT FROM au.raw_app_meta_data->>'role';
