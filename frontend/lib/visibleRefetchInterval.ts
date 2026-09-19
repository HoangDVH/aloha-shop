"use client";

/**
 * Visible-aware interval for React Query — pause when tab hidden.
 */
export function visibleRefetchInterval(ms: number): number | false | (() => number | false) {
  return () => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return false;
    }
    return ms;
  };
}
