"use client";

import { useEffect } from "react";
import { VISIT_STORAGE_KEY, nextVisitSession, readVisitSession, makeVisitId } from "@/lib/visitSession";

export function ProductViewTracker({ productCode }: { productCode: string }) {
  useEffect(() => {
    if (!productCode || navigator.webdriver) return;
    const controller = new AbortController();
    let sentSession = "", busy = false;
    const track = async () => {
      if (busy || controller.signal.aborted || document.visibilityState !== "visible") return;
      busy = true;
      const work = async () => {
        if (controller.signal.aborted) return;
        const session = nextVisitSession(readVisitSession(localStorage.getItem(VISIT_STORAGE_KEY)), Date.now(), makeVisitId);
        if (session.sessionId === sentSession) return;
        localStorage.setItem(VISIT_STORAGE_KEY, JSON.stringify(session));
        const response = await fetch("/api/shop/product-views", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitorId: session.visitorId, sessionId: session.sessionId, productCode }), signal: controller.signal });
        if (response.ok) sentSession = session.sessionId;
      };
      try { if (navigator.locks) await navigator.locks.request(VISIT_STORAGE_KEY, work); else await work(); }
      catch { /* Tracking must never block shopping. */ }
      finally { busy = false; }
    };
    void track();
    document.addEventListener("visibilitychange", track);
    return () => { controller.abort(); document.removeEventListener("visibilitychange", track); };
  }, [productCode]);
  return null;
}
