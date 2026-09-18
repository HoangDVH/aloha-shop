"use client";

import { useEffect } from "react";

/**
 * Sau khi domain chính chuyển từ KiotViet → shop:
 * gỡ Service Worker / Cache Storage cũ còn sót trên origin apex (hay gặp ở Edge).
 */
export function SiteDataMigrationCleanup() {
  useEffect(() => {
    const key = "aloha_apex_sw_cleared_v1";
    try {
      if (typeof window === "undefined") return;
      if (window.localStorage?.getItem(key) === "1") return;

      const tasks: Promise<unknown>[] = [];

      if ("serviceWorker" in navigator) {
        tasks.push(
          navigator.serviceWorker.getRegistrations().then((regs) =>
            Promise.all(regs.map((r) => r.unregister()))
          )
        );
      }
      if (typeof caches !== "undefined") {
        tasks.push(
          caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        );
      }

      void Promise.all(tasks).finally(() => {
        try {
          window.localStorage?.setItem(key, "1");
        } catch {
          /* ignore quota / private mode */
        }
      });
    } catch {
      /* ignore */
    }
  }, []);

  return null;
}
