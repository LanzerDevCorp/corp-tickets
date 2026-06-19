-- Custom Access Token Hook: copy app_metadata.role into JWT app_role claim.
-- Do NOT overwrite JWT "role" — PostgREST uses it as the Postgres session role.
-- Superseded by 20260619180000_fix_jwt_app_role_claim.sql if that migration is applied.
-- Enable in Supabase Dashboard: Authentication → Hooks → Custom Access Token Hook
-- URI: pg-functions://postgres/public/custom_access_token_hook

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  app_role text;
BEGIN
  claims := event->'claims';
  app_role := claims->'app_metadata'->>'role';

  IF app_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{role}', to_jsonb(app_role));
    event := jsonb_set(event, '{claims}', claims);
  END IF;

  RETURN event;
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon;
