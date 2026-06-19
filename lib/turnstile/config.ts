/**
 * Cloudflare Turnstile bot protection.
 * Set to `true` and configure env keys to re-enable — see docs/technical-debt.md.
 */
export const TURNSTILE_ENABLED = false;

export function isTurnstileEnabled(): boolean {
  return TURNSTILE_ENABLED;
}
