"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { establishBrowserSessionFromUrl } from "@/lib/auth/establish-browser-session";
import { formatTicketReference } from "@/lib/tickets/reference";

type Props = {
  children: React.ReactNode;
  hasServerSession: boolean;
};

type Status = "checking" | "ready" | "expired";

/**
 * Establishes session from legacy #access_token hash links, then refreshes so
 * server components can read cookies. New magic links use /auth/confirm instead.
 */
export function TrackSessionBootstrap({
  children,
  hasServerSession,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>(
    hasServerSession ? "ready" : "checking"
  );

  useEffect(() => {
    if (hasServerSession) return;

    const hasHash =
      typeof window !== "undefined" &&
      window.location.hash.includes("access_token");

    if (!hasHash) {
      setStatus("expired");
      return;
    }

    let cancelled = false;

    establishBrowserSessionFromUrl().then(({ ok }) => {
      if (cancelled) return;
      if (ok) {
        router.refresh();
        setStatus("ready");
        return;
      }
      setStatus("expired");
    });

    return () => {
      cancelled = true;
    };
  }, [hasServerSession, router]);

  useEffect(() => {
    if (status !== "expired") return;

    const ticketMatch = pathname.match(/^\/track\/(?!access$)([^/]+)$/);
    const ticketId = ticketMatch?.[1];
    const ref = ticketId ? formatTicketReference(ticketId) : undefined;
    const query = ref
      ? `?error_code=session_expired&ref=${encodeURIComponent(ref)}`
      : "?error_code=session_expired";

    router.replace(`/track/access${query}`);
  }, [status, router, pathname]);

  if (status === "checking") {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Verifying your link…
      </p>
    );
  }

  if (status === "expired") {
    return null;
  }

  return children;
}
