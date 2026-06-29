import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return document.cookie
            .split(";")
            .map((cookie) => cookie.trim())
            .filter(Boolean)
            .map((cookie) => {
              const separator = cookie.indexOf("=");
              const name = cookie.slice(0, separator);
              const value = cookie.slice(separator + 1);
              return { name, value: decodeURIComponent(value) };
            });
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            const parts = [
              `${name}=${encodeURIComponent(value)}`,
              `path=${options.path ?? "/"}`,
            ];
            if (options.maxAge !== undefined) {
              parts.push(`max-age=${options.maxAge}`);
            }
            if (options.domain) {
              parts.push(`domain=${options.domain}`);
            }
            if (options.sameSite) {
              parts.push(`samesite=${options.sameSite}`);
            }
            if (options.secure) {
              parts.push("secure");
            }
            document.cookie = parts.join("; ");
          });
        },
      },
    },
  );
}
