-- Seed data for local development and CI.
-- Loaded automatically on `supabase db reset` via config.toml [db.seed].
-- NOT applied to production — these are example records only.

INSERT INTO public.categories (name, is_enabled)
VALUES
  ('Soporte técnico', true),
  ('Facturación', true),
  ('General', true)
ON CONFLICT (name) DO NOTHING;

-- Test users (password for all: Test1234!@#$)
DO $$
DECLARE
  v_admin_id  uuid := '00000000-0000-0000-0000-000000000001';
  v_client_id uuid := '00000000-0000-0000-0000-000000000002';
BEGIN
  -- auth.users
  INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES
    (v_admin_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-admin@test.com',  crypt('Test1234!@#$', gen_salt('bf')), now(), '{"provider":"email","providers":["email"],"role":"admin"}',  '{"name":"Test Admin"}',  now(), now(), '', '', '', ''),
    (v_client_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test-client@test.com', crypt('Test1234!@#$', gen_salt('bf')), now(), '{"provider":"email","providers":["email"],"role":"client"}', '{"name":"Test Client"}', now(), now(), '', '', '', '')
  ON CONFLICT (id) DO NOTHING;

  -- auth.identities
  INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at) VALUES
    (gen_random_uuid(), v_admin_id::text,  v_admin_id,  jsonb_build_object('sub', v_admin_id::text,  'email', 'test-admin@test.com'),  'email', now(), now(), now()),
    (gen_random_uuid(), v_client_id::text, v_client_id, jsonb_build_object('sub', v_client_id::text, 'email', 'test-client@test.com'), 'email', now(), now(), now())
  ON CONFLICT (provider_id, provider) DO NOTHING;

  -- public.users
  INSERT INTO public.users (id, role, email, display_name, is_active) VALUES
    (v_admin_id,  'admin',  'test-admin@test.com',  'Test Admin',  true),
    (v_client_id, 'client', 'test-client@test.com', 'Test Client', true)
  ON CONFLICT (id) DO NOTHING;
END $$;
