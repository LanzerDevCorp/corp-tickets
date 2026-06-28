# Environment Variables in Next.js

## Load Priority (highest wins)

```
.env.local          ← always, all environments (gitignored — never commit)
.env.development    ← only when NODE_ENV=development (npm run dev)
.env.production     ← only when NODE_ENV=production (build/start)
.env                ← base fallback, all environments (safe to commit)
```

A key defined in `.env.local` overrides the same key in `.env`.

## File Purposes

| File               | Committed | Purpose                                               |
| ------------------ | --------- | ----------------------------------------------------- |
| `.env`             | ✅        | Base defaults — no secrets, safe values only          |
| `.env.local`       | ❌        | Local overrides — credentials, local URLs, API keys   |
| `.env.example`     | ✅        | Documentation — lists required keys with dummy values |
| `.env.development` | ✅        | Dev-only defaults (non-secret)                        |
| `.env.production`  | ✅        | Prod-only defaults (non-secret)                       |

## NEXT_PUBLIC_ Prefix Rule

Variables **without** the prefix are server-only — never exposed to the browser.  
Variables **with** `NEXT_PUBLIC_` are bundled into the client — visible in the browser.

```env
# Server-only (safe for secrets)
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=...
TURNSTILE_SECRET_KEY=...

# Client-safe (exposed in browser bundle)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_SITE_URL=...
```

Never put secrets in `NEXT_PUBLIC_*` variables.

## This Project's .env.local (local dev)

```env
# Supabase — local stack (supabase start)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<service role key from supabase status>

# App
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Resend — dummy (emails not sent in local dev)
RESEND_API_KEY=re_dummy_local
RESEND_FROM_EMAIL=noreply@localhost

# Turnstile — test key, always passes
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

Run `npx supabase status` to get the local keys after `supabase start`.
