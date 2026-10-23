"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, X } from "lucide-react";
import Link from "next/link";

type ToastItem = {
  id: number;
  message: string;
  href?: string;
  hrefLabel?: string;
};

type ToastApi = {
  push: (message: string, opts?: { href?: string; hrefLabel?: string }) => void;
};

const ToastCtx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    return {
      push: () => {
        /* no provider */
      },
    };
  }
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback(
    (message: string, opts?: { href?: string; hrefLabel?: string }) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setItems((prev) => [
        ...prev.slice(-2),
        { id, message, href: opts?.href, hrefLabel: opts?.hrefLabel },
      ]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, 3200);
    },
    []
  );

  const api = useMemo(() => ({ push }), [push]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed left-1/2 top-[calc(1rem+env(safe-area-inset-top,0px))] z-[9999] flex w-[min(92vw,440px)] -translate-x-1/2 flex-col items-center gap-2.5">
        {items.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex w-full items-center gap-3 rounded-2xl bg-slate-900/95 text-white px-4 py-3 shadow-2xl shadow-black/35 backdrop-blur-md ring-1 ring-white/15 animate-fade-down select-none"
            role="status"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30">
              <CheckCircle2 size={18} strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1 text-sm leading-snug">
              <p className="font-semibold text-white/95">{t.message}</p>
              {t.href ? (
                <Link
                  href={t.href}
                  className="mt-1 inline-block text-xs font-bold text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors"
                >
                  {t.hrefLabel || "Xem giỏ hàng"}
                </Link>
              ) : null}
            </div>
            <button
              type="button"
              className="rounded-lg p-1 text-white/50 hover:bg-white/15 hover:text-white transition cursor-pointer"
              onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
              aria-label="Đóng"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
