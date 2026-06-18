-- Seed data for local development and CI.
-- Loaded automatically on `supabase db reset` via config.toml [db.seed].
-- NOT applied to production — these are example records only.

INSERT INTO public.categories (name, is_enabled)
VALUES
  ('Soporte técnico', true),
  ('Facturación', true),
  ('General', true)
ON CONFLICT (name) DO NOTHING;
