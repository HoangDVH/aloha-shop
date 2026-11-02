"use client";

import { useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import { useHydrated } from "@/lib/useHydratedQuery";
import { ProductShareSheet, type ShareProps } from "./ProductShareSheet";

export type { ShareProps };

export function ProductShareButton(props: ShareProps) {
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const [shareCtv, setShareCtv] = useState(props.ctvCode);

  useEffect(() => {
    const handle = (event: Event) => {
      const detail = (event as CustomEvent<{ ma: string; ctvCode?: string }>).detail;
      if (detail?.ma !== props.ma) return;
      setShareCtv(detail.ctvCode || props.ctvCode);
      setOpen(true);
    };
    window.addEventListener("aloha-product-share", handle);
    return () => window.removeEventListener("aloha-product-share", handle);
  }, [props.ma, props.ctvCode]);

  return (
    <>
      <button
        type="button"
        disabled={!hydrated}
        aria-busy={!hydrated}
        onClick={() => {
          setShareCtv(props.ctvCode);
          setOpen(true);
        }}
        aria-haspopup="dialog"
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 active:scale-95"
      >
        <Share2 size={15} aria-hidden />
        Chia sẻ
      </button>
      {open ? (
        <ProductShareSheet {...props} ctvCode={shareCtv} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
