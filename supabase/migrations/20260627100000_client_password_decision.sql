-- Migration: client_password_decision
-- Adds password-decision signals to public.users for the Client Portal (Flow 2).
--
-- password_set_at:               stamped when a client creates a password.
-- password_prompt_dismissed_at:  stamped when a client skips the password prompt.
--
-- "Decided" = either column IS NOT NULL → the first-access set-password
-- interstitial is suppressed. Tracking "decided" (not merely "has password")
-- is what prevents nagging clients who chose to skip.
-- Both default NULL so existing clients are treated as "not yet decided".

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS password_prompt_dismissed_at TIMESTAMPTZ;
