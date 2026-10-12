"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackFunnel } from "@/lib/funnelTracking";
import { isVisitPage, makeVisitId, nextVisitSession, readVisitSession, VISIT_IDLE_MS, VISIT_SEND_MS, VISIT_STORAGE_KEY } from "@/lib/visitSession";

const STORAGE_KEY = VISIT_STORAGE_KEY;

export function ShopVisitTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || !isVisitPage(pathname) || navigator.webdriver) return;
    let stopped = false, busy = false, lastEvent = 0;
    const controller = new AbortController();
    const track = async (activity: boolean) => {
      if (stopped || busy || document.visibilityState !== "visible") return;
      busy = true;
      const work = async () => {
        if (stopped) return;
        const now = Date.now();
        const previous = readVisitSession(localStorage.getItem(STORAGE_KEY));
        // A timer must not keep an unattended tab's session alive.
        if (!activity && (!previous || now - previous.lastActivity >= VISIT_IDLE_MS)) return;
        const session = activity ? nextVisitSession(previous, now, makeVisitId) : previous!;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        if (now - session.lastSent < VISIT_SEND_MS) return;
        trackFunnel("visit", session);
        const response = await fetch("/api/shop/visits", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitorId: session.visitorId, sessionId: session.sessionId, path: pathname }),
          signal: controller.signal,
        });
        if (response.ok) {
          const latest = readVisitSession(localStorage.getItem(STORAGE_KEY));
          if (latest?.sessionId === session.sessionId) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...latest, lastSent: now }));
          }
        }
      };
      try {
        // Share a session across tabs and serialize the first request where supported.
        if (navigator.locks) await navigator.locks.request(STORAGE_KEY, work);
        else await work();
      } catch { /* Tracking/storage failures must never interrupt shopping. */ }
      finally { busy = false; }
    };
    const onActivity = () => {
      if (Date.now() - lastEvent < 5000) return;
      lastEvent = Date.now();
      void track(true);
    };
    const onVisible = () => { if (document.visibilityState === "visible") void track(true); };
    void track(true);
    const timer = window.setInterval(() => void track(false), VISIT_SEND_MS);
    window.addEventListener("pointerdown", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity);
    window.addEventListener("scroll", onActivity, { passive: true });
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true; controller.abort(); window.clearInterval(timer);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("scroll", onActivity);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname]);
  return null;
}
