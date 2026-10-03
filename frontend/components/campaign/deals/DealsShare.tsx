"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Link2, Share2 } from "lucide-react";
import { useToast } from "@/components/Toast";

function shareUrl(): string {
  const u = new URL(window.location.href);
  for (const k of ["focus", "src", "slot"]) u.searchParams.delete(k);
  u.searchParams.set("src", "share");
  return u.toString();
}

/** Chia sẻ trang ưu đãi: điện thoại dùng bảng chia sẻ của máy (Zalo, Messenger…); máy tính mở Facebook / sao chép link. */
export function DealsShare({ title }: { title: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const onShare = async () => {
    const url = shareUrl();
    const touch = window.matchMedia?.("(pointer: coarse)").matches;
    if (touch && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
      } catch {
        /* khách huỷ bảng chia sẻ */
      }
      return;
    }
    setOpen((o) => !o);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl());
      setCopied(true);
      toast.push("Đã sao chép link — dán vào Zalo hoặc Messenger để gửi bạn bè");
    } catch {
      toast.push("Không sao chép được, vui lòng copy link trên thanh địa chỉ");
    }
  };

  return (
    <div ref={boxRef} className="relative shrink-0">
      <button
        type="button"
        onClick={onShare}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#FFF0F5] px-3 text-xs font-bold text-[var(--campaign-primary,#C2185B)] ring-1 ring-[#F8BBD0] transition hover:bg-[#FFE4EC] active:scale-95"
      >
        <Share2 size={14} aria-hidden />
        Chia sẻ
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-56 rounded-2xl bg-white p-1.5 shadow-xl ring-1 ring-black/[0.06]">
          <a
            role="menuitem"
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl())}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex min-h-[40px] items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1877F2] text-[13px] font-black text-white" aria-hidden>
              f
            </span>
            Chia sẻ Facebook
          </a>
          <button
            role="menuitem"
            type="button"
            onClick={copy}
            className="flex min-h-[40px] w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-600" aria-hidden>
              {copied ? <Check size={14} strokeWidth={3} /> : <Link2 size={14} />}
            </span>
            {copied ? "Đã sao chép" : "Sao chép link (gửi Zalo)"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
