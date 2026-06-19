import { createClient } from "@/lib/supabase/client";

function parseHashParams(): URLSearchParams {
  if (typeof window === "undefined" || !window.location.hash) {
    return new URLSearchParams();
  }
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

function clearUrlHash() {
  window.history.replaceState(null, "", window.location.pathname);
}

/**
 * Establishes a Supabase session from implicit-flow hash tokens (#access_token=…).
 * Used as fallback when invite emails still use the default Supabase redirect.
 */
export async function establishBrowserSessionFromUrl(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const supabase = createClient();
  const hashParams = parseHashParams();
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");

  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) {
      return { ok: false, error: error.message };
    }
    clearUrlHash();
    return { ok: Boolean(data.session) };
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: Boolean(data.session) };
}
