import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getRedirectPath, isStaff } from "@/lib/auth/roles";
import type { Role } from "@/lib/auth/roles";

const PUBLIC_ROUTES = ["/", "/submit", "/track", "/auth"];
const STAFF_ONLY_PREFIXES = ["/dashboard", "/admin"];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/") || pathname.startsWith(route + "?")
  );
}

function isStaffOnlyRoute(pathname: string): boolean {
  return STAFF_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not run code between createServerClient and getClaims().
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const pathname = request.nextUrl.pathname;

  // Authenticated user on /auth/login → redirect away to avoid loop
  if (claims && pathname === "/auth/login") {
    const role = (claims.role as Role) ?? "client";
    const url = request.nextUrl.clone();
    url.pathname = getRedirectPath(role);
    return NextResponse.redirect(url);
  }

  // No session + protected (non-public) route → redirect to login
  if (!claims && !isPublicRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  // Authenticated client trying to access staff-only route → 403
  if (claims && isStaffOnlyRoute(pathname)) {
    const role = (claims.role as Role) ?? "client";
    if (!isStaff(role)) {
      const url = request.nextUrl.clone();
      url.pathname = "/403";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
