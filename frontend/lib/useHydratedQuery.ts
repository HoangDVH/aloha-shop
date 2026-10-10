"use client";

import { useSyncExternalStore } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

const subscribe = () => () => {};
const browserSnapshot = () => true;
const serverSnapshot = () => false;

export function useHydrated() {
  return useSyncExternalStore(subscribe, browserSnapshot, serverSnapshot);
}

/** Browser-only queries must keep the server snapshot until their boundary hydrates.
 * This also covers responses arriving while React is still streaming other boundaries.
 * The query cache and its mutations stay intact; only the initial render is gated.
 */
export function useHydratedQuery<T, E>(query: UseQueryResult<T, E>): UseQueryResult<T, E> {
  const hydrated = useHydrated();
  if (hydrated) return query;
  return {
    ...query,
    data: undefined,
    error: null,
    status: "pending",
    isPending: true,
    isLoading: true,
    isInitialLoading: true,
    isSuccess: false,
    isError: false,
    isLoadingError: false,
    isRefetchError: false,
    isFetched: false,
    isFetchedAfterMount: false,
    isPlaceholderData: false,
    isFetching: false,
    isRefetching: false,
    isPaused: false,
    fetchStatus: "idle",
    failureCount: 0,
    failureReason: null,
    dataUpdatedAt: 0,
    errorUpdatedAt: 0,
  } as UseQueryResult<T, E>;
}
