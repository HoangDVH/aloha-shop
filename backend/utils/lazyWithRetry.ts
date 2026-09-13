/**
 * React.lazy + thử lại khi Vite/HMR mất chunk (Failed to fetch dynamically imported module).
 * Lần đầu thất bại: thử lại vài lần; vẫn lỗi → tải lại trang 1 lần (tránh vòng lặp).
 */
import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const RELOAD_KEY = "aloha_lazy_chunk_reload";

type ModuleDefault<T> = { default: T };

export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<ModuleDefault<T>>,
  retries = 2
): LazyExoticComponent<T> {
  return lazy(async () => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const mod = await factory();
        try {
          sessionStorage.removeItem(RELOAD_KEY);
        } catch {
          /* ignore */
        }
        return mod;
      } catch (e) {
        lastErr = e;
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
        }
      }
    }

    try {
      if (sessionStorage.getItem(RELOAD_KEY) !== "1") {
        sessionStorage.setItem(RELOAD_KEY, "1");
        window.location.reload();
        return new Promise(() => {
          /* chờ reload */
        });
      }
      sessionStorage.removeItem(RELOAD_KEY);
    } catch {
      /* ignore */
    }
    throw lastErr;
  });
}
