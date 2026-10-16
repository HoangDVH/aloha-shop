"use client";

import { isVisitPage, makeVisitId, nextVisitSession, readVisitSession, VISIT_STORAGE_KEY } from "./visitSession";
type Identity = { visitorId: string; sessionId: string };
export function funnelSession(): Identity | undefined {
  if (typeof window === "undefined" || navigator.webdriver || !isVisitPage(window.location.pathname)) return;
  try {
    const session = nextVisitSession(readVisitSession(localStorage.getItem(VISIT_STORAGE_KEY)), Date.now(), makeVisitId);
    localStorage.setItem(VISIT_STORAGE_KEY, JSON.stringify(session));
    return { visitorId: session.visitorId, sessionId: session.sessionId };
  } catch { return; }
}
export function trackFunnel(event: "visit" | "cart" | "checkout", identity?: Identity) {
  const session = identity ?? funnelSession();
  if (!session || typeof window === "undefined" || navigator.webdriver || !isVisitPage(window.location.pathname)) return;
  try {
    void fetch("/api/shop/funnel", { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
      body: JSON.stringify({ visitorId: session.visitorId, sessionId: session.sessionId,
        path: window.location.pathname, event }) }).catch(() => {});
  } catch { /* Analytics cannot interrupt cart or checkout. */ }
}
