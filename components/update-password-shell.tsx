"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { UpdatePasswordForm } from "@/components/update-password-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Status = "loading" | "ready" | "invalid";

function parseHashParams(): URLSearchParams {
  if (typeof window === "undefined" || !window.location.hash) {
    return new URLSearchParams();
  }
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

function clearUrlHash() {
  window.history.replaceState(null, "", window.location.pathname);
}

async function establishSessionFromUrl() {
  const supabase = createClient();
  const hashParams = parseHashParams();
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    clearUrlHash();
    return true;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return Boolean(data.session);
}

export function UpdatePasswordShell() {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let cancelled = false;

    establishSessionFromUrl()
      .then((hasSession) => {
        if (cancelled) return;
        setStatus(hasSession ? "ready" : "invalid");
      })
      .catch(() => {
        if (!cancelled) setStatus("invalid");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Verifying link…</CardTitle>
          <CardDescription>Setting up your session.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (status === "invalid") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Reset link invalid</CardTitle>
          <CardDescription>
            Request a new password reset from the login page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/auth/forgot-password">Request reset</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <UpdatePasswordForm />;
}
