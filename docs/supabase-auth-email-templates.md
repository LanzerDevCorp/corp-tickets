# Supabase Auth email templates (production)

Staff invites and password resets must hit **`/auth/confirm`** on the server so the session is stored in cookies before the Next.js app loads. The default Supabase template redirects with `#access_token=…` in the URL hash, which is fragile in SSR apps.

Copy the HTML from:

- `supabase/templates/invite.html` → Dashboard → **Authentication → Email Templates → Invite user**
  - **Subject:** `Te invitaron a Corp Tickets`
- `supabase/templates/recovery.html` → **Authentication → Email Templates → Reset password**
  - **Subject:** `Restablece tu contraseña en Corp Tickets`

Each link uses:

```html
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/auth/accept-invite
```

## Dashboard checklist

1. **Site URL**: `https://corp-tickets.vercel.app`
2. **Redirect URLs** (add all):
   - `https://corp-tickets.vercel.app/auth/confirm`
   - `https://corp-tickets.vercel.app/auth/accept-invite`
   - `https://corp-tickets.vercel.app/auth/update-password`
3. **Invite + Recovery templates**: paste from `supabase/templates/` (see above)
4. **Resend SMTP**: disable **click tracking / link tracking** on the sending domain. Wrapped links break Supabase tokens ([Supabase SMTP docs](https://supabase.com/docs/guides/deployment/going-into-prod#email-link-validity)).
5. **Vercel env**: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` must match the active publishable key in Supabase → Project Settings → API.

After changing templates, send a **new** invite (`pnpm invite:staff … --delete-if-exists`). Old email links are one-time use.
