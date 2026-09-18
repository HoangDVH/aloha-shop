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
      <div className="pointer-events-none fixed left-1/2 top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-[200] flex w-[min(92vw,360px)] -translate-x-1/2 flex-col gap-2 md:left-auto md:right-4 md:top-auto md:bottom-4 md:translate-x-0">
        {items.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 rounded-xl bg-white p-3 shadow-lg ring-1 ring-[#D5E3D0] animate-fade-up"
            role="status"
          >
            <CheckCircle2 className="mt-0.5 shrink-0 text-[var(--aloha-green)]" size={20} />
            <div className="min-w-0 flex-1 text-sm text-[var(--aloha-ink)]">
              <p className="font-semibold">{t.message}</p>
              {t.href ? (
                <Link
                  href={t.href}
                  className="mt-1 inline-block text-xs font-bold text-[var(--aloha-green)] underline-offset-2 hover:underline"
                >
                  {t.hrefLabel || "Xem giỏ hàng"}
                </Link>
              ) : null}
            </div>
            <button
              type="button"
              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
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
