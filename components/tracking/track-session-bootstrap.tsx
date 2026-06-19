"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { establishBrowserSessionFromUrl } from "@/lib/auth/establish-browser-session";

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
    router.replace("/auth/error?error_code=otp_expired");
  }, [status, router]);

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
