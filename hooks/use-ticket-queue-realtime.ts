"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribes the staff dashboard to Supabase Realtime Postgres Changes on the
 * `tickets` table. On any INSERT or UPDATE event the TanStack Query cache is
 * invalidated with the partial key `["tickets"]` so every filter variant
 * refetches via the existing `getTickets` server action.
 *
 * Postgres Changes are filtered by RLS, which needs the user's JWT (carrying the
 * `app_role` claim). The browser client authenticates the socket with the
 * publishable key — not a JWT — so the session access token must be passed via
 * `realtime.setAuth` before subscribing, otherwise the staff policy silently
 * drops every event.
 *
 * The channel is cleaned up when the component that calls this hook unmounts.
 */
export function useTicketQueueRealtime(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | undefined;

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await supabase.realtime.setAuth(session?.access_token);

      const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ["tickets"] });

      channel = supabase
        .channel("ticket-queue")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "tickets" },
          invalidate,
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "tickets" },
          invalidate,
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.error(
              "[ticket-queue realtime] subscription failed:",
              status,
            );
          }
        });
    })();

    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
