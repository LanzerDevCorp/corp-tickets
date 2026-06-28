import { isTurnstileEnabled } from "./config";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileVerifyResult =
  { success: true } | { success: false; error: string };

export async function verifyTurnstileToken(
  token: string,
): Promise<TurnstileVerifyResult> {
  if (!isTurnstileEnabled()) {
    return { success: true };
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    console.error("[Turnstile] TURNSTILE_SECRET_KEY is not set");
    return { success: false, error: "Configuración de seguridad incompleta" };
  }

  let response: Response;
  try {
    response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
  } catch (err) {
    console.error("[Turnstile] Network error during siteverify", err);
    return {
      success: false,
      error: "Error de red al verificar la seguridad",
    };
  }

  if (!response.ok) {
    console.error("[Turnstile] siteverify HTTP error", response.status);
    return {
      success: false,
      error: "La verificación de seguridad falló. Intenta de nuevo.",
    };
  }

  const data = (await response.json()) as { success: boolean };

  if (!data.success) {
    return {
      success: false,
      error: "La verificación de seguridad falló. Intenta de nuevo.",
    };
  }

  return { success: true };
}
