"use client";

/**
 * Search kiểu sàn + Telex Unikey:
 * - Input gần như uncontrolled khi gõ — tránh React value= xung đột IME (phải bấm Space).
 * - Search theo chữ đang hiện trên ô (onInput), không chờ chốt dấu.
 * - Chọn SP bằng mousedown — một lần vào PDP.
 * - Đang tải: giữ list cũ, không báo «không khớp» giả.
 */
import { FormEvent, KeyboardEvent, useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { searchProductsClient, type ShopProduct } from "@/lib/api";
import { prefetchShopPaths } from "@/lib/prefetchShop";
import { useShopRouter } from "@/lib/useShopRouter";
import { SearchResultLink } from "@/components/SearchResultLink";

const DEBOUNCE_MS = 180;
const PANEL_Z = 10050;

type PanelPos = { top: number; left: number; width: number };

function productHref(p: ShopProduct) {
  const path = String(p.path || "").trim();
  if (path.startsWith("/") && !path.startsWith("//") && path.length > 1) return path;
  if (p.ma) return `/sp/${encodeURIComponent(p.ma)}`;
  return "/tim";
}

function isImeKey(e: KeyboardEvent) {
  return e.nativeEvent.isComposing || e.keyCode === 229;
}

export function HeaderSearch({ onSubmitExtra }: { onSubmitExtra?: () => void }) {
  const router = useShopRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reqSeq = useRef(0);
  const openRef = useRef(false);
  const composingRef = useRef(false);
  const navigatingRef = useRef(false);

  /** Chữ dùng để search + UI — đồng bộ từ DOM input (không ép value khi đang Telex). */
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [items, setItems] = useState<ShopProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [active, setActive] = useState(-1);
  const [panelPos, setPanelPos] = useState<PanelPos>({ top: 0, left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);
  const [hasClear, setHasClear] = useState(false);

  openRef.current = open;

  const readInput = () => String(inputRef.current?.value || "");

  const applyQuery = (raw: string, openPanel = true) => {
    const v = raw;
    setQ(v);
    setHasClear(v.length > 0);
    if (openPanel && v.trim().length >= 2) setOpen(true);
  };

  useEffect(() => setMounted(true), []);

  const qFromUrl = pathname === "/tim" ? String(searchParams.get("q") || "") : "";
  useEffect(() => {
    if (inputRef.current) inputRef.current.value = qFromUrl;
    setQ(qFromUrl);
    setHasClear(qFromUrl.length > 0);
    setOpen(false);
    setItems([]);
    setTotal(0);
    setActive(-1);
    setErr("");
    setLoading(false);
    reqSeq.current += 1;
    composingRef.current = false;
    navigatingRef.current = false;
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
    const termAtStart = term;

    const run = (fromSync = false) => {
      if (navigatingRef.current) return;
      if (fromSync && openRef.current) return;
      searchProductsClient(termAtStart, 8)
        .then((res) => {
          if (seq !== reqSeq.current || navigatingRef.current) return;
          const list = res.items || [];
          setItems(list);
          setTotal(Number(res.total) || 0);
          if (document.activeElement === inputRef.current) setOpen(true);
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
          setErr(e?.message || "Không tìm được.");
          if (document.activeElement === inputRef.current) setOpen(true);
        })
        .finally(() => {
          if (seq === reqSeq.current) setLoading(false);
        });
    };

    const t = window.setTimeout(() => run(false), DEBOUNCE_MS);
    let cancelled = false;
    let off: (() => void) | undefined;
    void import("@/lib/catalogSync").then(({ onShopCatalogChanged }) => {
      if (cancelled) return;
      off = onShopCatalogChanged(() => {
        if (q.trim().length < 2) return;
        run(true);
      });
    });

    return () => {
      cancelled = true;
      window.clearTimeout(t);
      off?.();
    };
  }, [q, router]);

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
    if (!showPanel) return;
    document.documentElement.setAttribute("data-shop-search-open", "1");
    const nav = document.querySelector("header nav") as HTMLElement | null;
    const prev = nav?.style.pointerEvents ?? "";
    if (nav) nav.style.pointerEvents = "none";
    return () => {
      document.documentElement.removeAttribute("data-shop-search-open");
      if (nav) nav.style.pointerEvents = prev;
    };
  }, [showPanel]);

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

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (composingRef.current) return;
    const term = readInput();
    applyQuery(term, false);
    if (active >= 0 && items[active]) {
      navigatingRef.current = true;
      window.location.href = productHref(items[active]);
      return;
    }
    goSearchPage(term);
  };

  const showEmpty = !err && !loading && items.length === 0 && q.trim().length >= 2;

  const panel = showPanel ? (
    <div
      ref={panelRef}
      id={listId}
      role="listbox"
      onMouseDown={(e) => e.preventDefault()}
      className="max-h-[min(70vh,420px)] overflow-auto rounded-lg border border-[var(--aloha-line)] bg-white shadow-xl"
      style={{
        position: "fixed",
        top: panelPos.top,
        left: panelPos.left,
        width: panelPos.width,
        zIndex: PANEL_Z,
      }}
    >
      {err ? <p className="px-4 py-3 text-sm text-amber-800">{err}</p> : null}
      {!err && loading && items.length === 0 ? (
        <p className="px-4 py-3 text-sm text-slate-500">Đang tìm…</p>
      ) : null}
      {showEmpty ? (
        <p className="px-4 py-3 text-sm text-slate-500">Không có sản phẩm khớp «{q.trim()}»</p>
      ) : null}
      <ul className="divide-y divide-[#F0EBE0]">
        {items.map((p, i) => (
          <li key={p.ma}>
            <SearchResultLink
              product={p}
              active={i === active}
              router={router}
              onNavigate={() => {
                navigatingRef.current = true;
              }}
            />
          </li>
        ))}
      </ul>
      {total > items.length ? (
        <button
          type="button"
          className="w-full border-t border-[var(--aloha-line)] px-4 py-2.5 text-center text-sm font-semibold text-[var(--aloha-green)] hover:bg-[var(--aloha-cream)]"
          onClick={() => goSearchPage(readInput() || q)}
        >
          Xem tất cả {total} kết quả
        </button>
      ) : items.length > 0 ? (
        <button
          type="button"
          className="w-full border-t border-[var(--aloha-line)] px-4 py-2.5 text-center text-sm font-semibold text-[var(--aloha-green)] hover:bg-[var(--aloha-cream)]"
          onClick={() => goSearchPage(readInput() || q)}
        >
          Xem trang kết quả tìm kiếm
        </button>
      ) : null}
    </div>
  ) : null;

  return (
    <div ref={wrapRef} className={`relative w-full min-w-0 ${showPanel ? "z-[100]" : ""}`}>
      <form onSubmit={onSubmit} className="flex w-full min-w-0 items-stretch" role="search">
        <div className="relative flex w-full min-w-0 items-stretch overflow-hidden rounded-full border border-[var(--aloha-line)] bg-white shadow-sm focus-within:border-[var(--aloha-green)] lg:rounded-md">
          <div className="relative min-w-0 flex-1">
            <Search
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[#5A6B5E]"
              aria-hidden
            />
            {/*
              Không dùng value={q} — Unikey/Telex + controlled input hay bắt phải Space.
              Đọc chữ từ DOM qua onInput / compositionupdate.
            */}
            <input
              ref={inputRef}
              defaultValue={qFromUrl}
              onCompositionStart={() => {
                composingRef.current = true;
              }}
              onCompositionUpdate={(e) => {
                // Chuỗi đang gõ (kể cả chưa Space) → search theo chữ đang hiện.
                applyQuery(e.currentTarget.value);
              }}
              onCompositionEnd={(e) => {
                composingRef.current = false;
                applyQuery(e.currentTarget.value);
              }}
              onInput={(e) => {
                applyQuery(e.currentTarget.value);
              }}
              onFocus={() => {
                const v = readInput();
                if (v.trim().length >= 2 && items.length > 0) setOpen(true);
              }}
              onKeyDown={(e) => {
                if (isImeKey(e)) return;
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
                  navigatingRef.current = true;
                  window.location.href = productHref(items[active]);
                }
              }}
              placeholder="Tìm sản phẩm, mã SP…"
              autoComplete="off"
              spellCheck={false}
              aria-autocomplete="list"
              aria-controls={listId}
              aria-expanded={showPanel}
              className={`min-w-0 w-full border-0 bg-transparent py-2.5 pl-10 text-sm text-[var(--aloha-ink)] outline-none placeholder:text-slate-400 ${
                hasClear ? "pr-11" : "pr-2"
              }`}
            />
            {hasClear ? (
              <button
                type="button"
                aria-label="Xóa"
                className="absolute right-1 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-black/5 hover:text-slate-700"
                onClick={() => {
                  if (inputRef.current) inputRef.current.value = "";
                  setQ("");
                  setHasClear(false);
                  setItems([]);
                  setOpen(false);
                  inputRef.current?.focus();
                }}
              >
                <X size={16} />
              </button>
            ) : null}
          </div>
          <button
            type="submit"
            aria-label="Tìm kiếm"
            className="relative z-10 inline-flex min-h-11 w-11 shrink-0 items-center justify-center bg-[var(--aloha-green)] text-sm font-bold text-white hover:bg-[var(--aloha-green-mid)] sm:w-auto sm:min-w-[5.5rem] sm:px-4"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <Search size={18} className="sm:hidden" aria-hidden />
                <span className="hidden sm:inline">Tìm kiếm</span>
              </>
            )}
          </button>
        </div>
      </form>

      {mounted && panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
