"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribes the staff dashboard to Supabase Realtime Postgres Changes on
 * the `tickets` table. On any INSERT or UPDATE event the TanStack Query cache
 * is invalidated with the partial key `["tickets"]` so every filter variant
 * refetches via the existing `getTickets` server action.
 *
 * The channel is cleaned up when the component that calls this hook unmounts.
 */
export function useTicketQueueRealtime(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("ticket-queue")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tickets" },
        () => queryClient.invalidateQueries({ queryKey: ["tickets"] }),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tickets" },
        () => queryClient.invalidateQueries({ queryKey: ["tickets"] }),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
