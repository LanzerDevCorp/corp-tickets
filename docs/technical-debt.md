# Deuda técnica

## Cloudflare Turnstile (deshabilitado)

**Estado:** apagado temporalmente (`lib/turnstile/config.ts` → `TURNSTILE_ENABLED = false`)

**Contexto:** El formulario público de tickets tenía protección anti-bots con Cloudflare Turnstile (widget invisible + verificación server-side vía Siteverify). Se desactivó para simplificar el setup local y el despliegue inicial sin credenciales de Cloudflare.

**Código existente (conservado):**

| Archivo                                    | Rol                                             |
| ------------------------------------------ | ----------------------------------------------- |
| `lib/turnstile/config.ts`                  | Flag de activación                              |
| `lib/turnstile/verify.ts`                  | Verificación server-side (Siteverify API)       |
| `components/public/public-ticket-form.tsx` | Widget Turnstile en el formulario               |
| `lib/schemas/ticket-submit.ts`             | Validación del token en el schema               |
| `app/actions/tickets.ts`                   | Llama a `verifyTurnstileToken` antes del insert |
| `.agents/skills/turnstile-spin/`           | Skill de integración Cloudflare                 |

**Para reactivar:**

1. Crear widget en [Cloudflare Turnstile](https://dash.cloudflare.com/turnstile) (o usar claves de prueba en local).
2. Configurar variables de entorno:
   ```env
   NEXT_PUBLIC_TURNSTILE_SITE_KEY=...
   TURNSTILE_SECRET_KEY=...
   ```
   Claves de prueba (siempre pasan): ver [Testing](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
3. Cambiar `TURNSTILE_ENABLED` a `true` en `lib/turnstile/config.ts`.
4. Verificar formulario público, tests unitarios y E2E (`tests/e2e/public-form/submit.spec.ts`).

**Referencia de diseño original:** `docs/phase-4-public-form.md` (sección Cloudflare Turnstile).
