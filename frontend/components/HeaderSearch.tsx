"use client";

import { FormEvent, useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { searchProductsClient, type ShopProduct } from "@/lib/api";
import { prefetchShopPath, prefetchShopPaths } from "@/lib/prefetchShop";
import { useShopRouter } from "@/lib/useShopRouter";
import { SearchResultLink } from "@/components/SearchResultLink";

const DEBOUNCE_MS = 280;

type PanelPos = { top: number; left: number; width: number };

export function HeaderSearch({ onSubmitExtra }: { onSubmitExtra?: () => void }) {
  const router = useShopRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [items, setItems] = useState<ShopProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [active, setActive] = useState(-1);
  const [panelPos, setPanelPos] = useState<PanelPos>({ top: 0, left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);
  const reqSeq = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Chỉ mở dropdown khi đang gõ / focus ô tìm — tránh catalog sync (SSE/poll) tự bật lại. */
  const shouldShowSuggest = () =>
    typeof document !== "undefined" && document.activeElement === inputRef.current;

  useEffect(() => setMounted(true), []);

  // Giống Shopee: giữ chữ trên /tim?q=…; về trang chủ / trang khác thì xóa
  const qFromUrl = pathname === "/tim" ? String(searchParams.get("q") || "") : "";
  useEffect(() => {
    setQ(qFromUrl);
    setOpen(false);
    setItems([]);
    setTotal(0);
    setActive(-1);
    setErr("");
    setLoading(false);
    reqSeq.current += 1;
  }, [pathname, qFromUrl]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setItems([]);
      setTotal(0);
      setErr("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr("");
    const seq = ++reqSeq.current;
    const run = () => {
      searchProductsClient(term, 8)
        .then((res) => {
          if (seq !== reqSeq.current) return;
          const list = res.items || [];
          setItems(list);
          setTotal(Number(res.total) || 0);
          if (shouldShowSuggest()) setOpen(true);
          setActive(-1);
          prefetchShopPaths(
            router,
            list.map((p) => p.path)
          );
        })
        .catch((e: Error) => {
          if (seq !== reqSeq.current) return;
          setItems([]);
          setTotal(0);
          setErr(e?.message || "Không tìm được. Kiểm tra API :3000.");
          if (shouldShowSuggest()) setOpen(true);
        })
        .finally(() => {
          if (seq === reqSeq.current) setLoading(false);
        });
    };

    const t = window.setTimeout(run, DEBOUNCE_MS);

    let cancelled = false;
    let off: (() => void) | undefined;
    void import("@/lib/catalogSync").then(({ onShopCatalogChanged }) => {
      if (cancelled) return;
      off = onShopCatalogChanged(() => {
        if (q.trim().length < 2) return;
        // Cập nhật kết quả im lặng; chỉ mở panel nếu đang focus ô tìm
        void run();
      });
    });

    return () => {
      cancelled = true;
      window.clearTimeout(t);
      off?.();
    };
  }, [q, router]);

  useEffect(() => {
    if (active >= 0 && items[active]) {
      prefetchShopPath(router, items[active].path);
    }
  }, [active, items, router]);

  const placePanel = useCallback(() => {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const width = Math.min(rect.width, window.innerWidth - 16);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    setPanelPos({ top: rect.bottom + 4, left, width });
  }, []);

  const showPanel = open && q.trim().length >= 2;

  useEffect(() => {
    if (!showPanel) return;
    placePanel();
    window.addEventListener("resize", placePanel);
    window.addEventListener("scroll", placePanel, true);
    return () => {
      window.removeEventListener("resize", placePanel);
      window.removeEventListener("scroll", placePanel, true);
    };
  }, [showPanel, placePanel, items.length, err, loading]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const goSearchPage = (term: string) => {
    const t = term.trim();
    startTransition(() => {
      router.push(t ? `/tim?q=${encodeURIComponent(t)}` : "/tim");
    });
    setOpen(false);
    onSubmitExtra?.();
  };

  const goProduct = (path: string) => {
    startTransition(() => {
      router.push(path);
    });
    setOpen(false);
    onSubmitExtra?.();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (active >= 0 && items[active]) {
      goProduct(items[active].path);
      return;
    }
    goSearchPage(q);
  };

  const panel = showPanel ? (
    <div
      ref={panelRef}
      id={listId}
      role="listbox"
      /** Giữ focus ô tìm; tránh blur trước click → phải bấm 2 lần */
      onMouseDown={(e) => e.preventDefault()}
      className="max-h-[min(70vh,420px)] overflow-auto rounded-lg border border-[var(--aloha-line)] bg-white shadow-xl"
      style={{
        position: "fixed",
        top: panelPos.top,
        left: panelPos.left,
        width: panelPos.width,
        zIndex: 200,
      }}
    >
      {err ? <p className="px-4 py-3 text-sm text-amber-800">{err}</p> : null}
      {!err && !loading && items.length === 0 ? (
        <p className="px-4 py-3 text-sm text-slate-500">Không có sản phẩm khớp «{q.trim()}»</p>
      ) : null}
      <ul className="divide-y divide-[#F0EBE0]">
        {items.map((p, i) => (
          <li key={p.ma} role="option" aria-selected={i === active}>
            <SearchResultLink
              product={p}
              active={i === active}
              router={router}
              onPick={() => {
                setOpen(false);
                onSubmitExtra?.();
              }}
              onHover={() => setActive(i)}
            />
          </li>
        ))}
      </ul>
      {total > items.length ? (
        <button
          type="button"
          className="w-full border-t border-[var(--aloha-line)] px-4 py-2.5 text-center text-sm font-semibold text-[var(--aloha-green)] hover:bg-[var(--aloha-cream)]"
          onClick={() => goSearchPage(q)}
        >
          Xem tất cả {total} kết quả
        </button>
      ) : items.length > 0 ? (
        <button
          type="button"
          className="w-full border-t border-[var(--aloha-line)] px-4 py-2.5 text-center text-sm font-semibold text-[var(--aloha-green)] hover:bg-[var(--aloha-cream)]"
          onClick={() => goSearchPage(q)}
        >
          Xem trang kết quả tìm kiếm
        </button>
      ) : null}
    </div>
  ) : null;

  return (
    <div ref={wrapRef} className={`relative w-full flex-1 ${showPanel ? "z-[100]" : ""}`}>
      <form onSubmit={onSubmit} className="flex w-full items-stretch" role="search">
        <div className="relative flex min-w-0 flex-1 items-stretch overflow-hidden rounded-md border border-white/30 bg-white shadow-sm focus-within:border-[#F7F0E3]">
          <div className="relative min-w-0 flex-1">
            <Search
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[#5A6B5E]"
            />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOpen(true);
              }}
              onFocus={() => {
                if (q.trim().length >= 2 && items.length > 0) setOpen(true);
              }}
              onBlur={() => {
                // Trì hoãn: click vào panel dùng preventDefault nên vẫn giữ focus;
                // nếu blur thật (ra ngoài) thì đóng.
                window.setTimeout(() => {
                  if (!shouldShowSuggest()) setOpen(false);
                }, 0);
              }}
              onKeyDown={(e) => {
                if (!showPanel || !items.length) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((i) => Math.min(items.length - 1, i + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((i) => Math.max(-1, i - 1));
                } else if (e.key === "Escape") {
                  setOpen(false);
                  setActive(-1);
                } else if (e.key === "Enter" && active >= 0 && items[active]) {
                  e.preventDefault();
                  goProduct(items[active].path);
                }
              }}
              placeholder="Tìm theo tên, mã SP…"
              autoComplete="off"
              aria-autocomplete="list"
              aria-controls={listId}
              aria-expanded={showPanel}
              className={`min-w-0 w-full border-0 bg-transparent py-2.5 pl-10 text-sm text-[var(--aloha-ink)] outline-none placeholder:text-slate-400 ${
                q ? "pr-9" : "pr-3"
              }`}
            />
            {q ? (
              <button
                type="button"
                aria-label="Xóa"
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-black/5 hover:text-slate-700"
                onClick={() => {
                  setQ("");
                  setItems([]);
                  setOpen(false);
                }}
              >
                <X size={16} />
              </button>
            ) : null}
          </div>
          <button
            type="submit"
            className="relative z-10 shrink-0 border-l border-white/20 bg-[var(--aloha-green-mid)] px-3 text-sm font-bold text-white hover:bg-[var(--aloha-green-dark)] sm:px-4"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : "Tìm kiếm"}
          </button>
        </div>
      </form>

      {mounted && panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
