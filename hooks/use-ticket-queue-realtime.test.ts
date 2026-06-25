import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock the Supabase browser client before importing the hook.
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/client";
import { useTicketQueueRealtime } from "./use-ticket-queue-realtime";

const mockCreateClient = vi.mocked(createClient);

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// --------------------------------------------------------------------------
// Shared channel mock factory (recreated per test to get fresh spies)
// --------------------------------------------------------------------------

function buildChannelMocks() {
  const callbacks: Record<string, (() => void) | undefined> = {};

  const mockSubscribe = vi.fn();
  const mockOn = vi.fn();
  const mockRemoveChannel = vi.fn();

  const channelObj = {
    on: mockOn,
    subscribe: mockSubscribe,
  };

  // .on() captures the callback per event type and returns itself for chaining.
  mockOn.mockImplementation(
    (_type: string, filter: { event: string }, cb: () => void) => {
      callbacks[filter.event] = cb;
      return channelObj;
    }
  );

  // .subscribe() returns the channel so it can be passed to removeChannel.
  mockSubscribe.mockReturnValue(channelObj);

  const mockChannel = vi.fn().mockReturnValue(channelObj);

  mockCreateClient.mockReturnValue({
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  } as any);

  return { channelObj, mockChannel, mockSubscribe, mockOn, mockRemoveChannel, callbacks };
}

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe("useTicketQueueRealtime", () => {
  let queryClient: QueryClient;
  let invalidateQueriesSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
  });

  it("creates a channel named 'ticket-queue' and calls subscribe on mount", () => {
    const { mockChannel, mockSubscribe } = buildChannelMocks();

    renderHook(() => useTicketQueueRealtime(), {
      wrapper: makeWrapper(queryClient),
    });

    expect(mockChannel).toHaveBeenCalledWith("ticket-queue");
    expect(mockSubscribe).toHaveBeenCalled();
  });

  it("INSERT event triggers invalidateQueries with partial key ['tickets']", () => {
    const { callbacks } = buildChannelMocks();

    renderHook(() => useTicketQueueRealtime(), {
      wrapper: makeWrapper(queryClient),
    });

    expect(callbacks["INSERT"]).toBeDefined();
    callbacks["INSERT"]!();

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["tickets"] });
  });

  it("UPDATE event triggers invalidateQueries with partial key ['tickets']", () => {
    const { callbacks } = buildChannelMocks();

    renderHook(() => useTicketQueueRealtime(), {
      wrapper: makeWrapper(queryClient),
    });

    expect(callbacks["UPDATE"]).toBeDefined();
    callbacks["UPDATE"]!();

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["tickets"] });
  });

  it("calls supabase.removeChannel with the channel on unmount", () => {
    const { channelObj, mockRemoveChannel } = buildChannelMocks();

    const { unmount } = renderHook(() => useTicketQueueRealtime(), {
      wrapper: makeWrapper(queryClient),
    });

    unmount();

    expect(mockRemoveChannel).toHaveBeenCalledWith(channelObj);
  });
});
