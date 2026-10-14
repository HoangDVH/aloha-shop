"use client";
import { useEffect } from "react";
import { recoverChunk, reportClientError } from "@/lib/clientRecovery";

export function ClientErrorMonitor() {
  useEffect(() => {
    const capture = (error: unknown, source: string) => {
      reportClientError(error, source);
      if (error instanceof Error) recoverChunk(error);
    };
    const onError = (event: ErrorEvent) => capture(event.error || event.message, "window");
    const onRejection = (event: PromiseRejectionEvent) => capture(event.reason, "promise");
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
