"use client";

/**
 * Search kiểu sàn + Telex Unikey:
 * - Input gần như uncontrolled khi gõ — tránh React value= xung đột IME (phải bấm Space).
 * - Search theo chữ đang hiện trên ô (onInput), không chờ chốt dấu.
 * - Chọn SP bằng mousedown — một lần vào PDP.
 * - Đang tải: giữ list cũ, không báo «không khớp» giả.
 * - Mobile Full-screen Overlay với Lịch sử tìm kiếm & Từ khóa phổ biến (chuẩn Shopee / TikTok Shop).
 */
import { FormEvent, KeyboardEvent, useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft, Clock, Flame, Loader2, Search, Trash2, X } from "lucide-react";
import { searchProductsClient, type ShopProduct } from "@/lib/api";
import { prefetchShopPaths } from "@/lib/prefetchShop";
import { useShopRouter } from "@/lib/useShopRouter";
import { SearchResultLink } from "@/components/SearchResultLink";
import { POPULAR_SEARCHES } from "@/lib/popularSearches";

const DEBOUNCE_MS = 180;
const PANEL_Z = 10050;
const RECENT_KEY = "aloha_recent_searches";

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(term: string) {
  if (typeof window === "undefined" || !term.trim()) return;
  try {
    const prev = getRecentSearches();
    const clean = term.trim();
    const next = [clean, ...prev.filter((x) => x.toLowerCase() !== clean.toLowerCase())].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

function clearRecentSearches() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {}
}

function removeRecentSearch(term: string) {
  if (typeof window === "undefined") return;
  try {
    const prev = getRecentSearches();
    const next = prev.filter((x) => x.toLowerCase() !== term.toLowerCase());
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

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
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const reqSeq = useRef(0);
  const openRef = useRef(false);
  const composingRef = useRef(false);
  const navigatingRef = useRef(false);

  /** Chữ dùng để search + UI — đồng bộ từ DOM input (không ép value khi đang Telex). */
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [mobileOverlayOpen, setMobileOverlayOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [items, setItems] = useState<ShopProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [active, setActive] = useState(-1);
  const [panelPos, setPanelPos] = useState<PanelPos>({ top: 0, left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);
  const [hasClear, setHasClear] = useState(false);

  openRef.current = open;

  const readInput = () => String(inputRef.current?.value || mobileInputRef.current?.value || q || "");

  const applyQuery = (raw: string, openPanel = true) => {
    const v = raw;
    setQ(v);
    setHasClear(v.length > 0);
    if (inputRef.current && inputRef.current.value !== v) inputRef.current.value = v;
    if (mobileInputRef.current && mobileInputRef.current.value !== v) mobileInputRef.current.value = v;
    if (openPanel) setOpen(true);
  };

  useEffect(() => {
    setMounted(true);
    setRecentSearches(getRecentSearches());
  }, []);

  // Lock body scroll when mobile search overlay is open
  useEffect(() => {
    if (!mobileOverlayOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setRecentSearches(getRecentSearches());
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOverlayOpen]);

  const qFromUrl = pathname === "/tim" ? String(searchParams.get("q") || "") : "";
  useEffect(() => {
    if (inputRef.current) inputRef.current.value = qFromUrl;
    if (mobileInputRef.current) mobileInputRef.current.value = qFromUrl;
    setQ(qFromUrl);
    setHasClear(qFromUrl.length > 0);
    setOpen(false);
    setMobileOverlayOpen(false);
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
          if (document.activeElement === inputRef.current || mobileOverlayOpen) setOpen(true);
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
          if (document.activeElement === inputRef.current || mobileOverlayOpen) setOpen(true);
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
  }, [q, router, mobileOverlayOpen]);

  const placePanel = useCallback(() => {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const width = Math.min(rect.width, window.innerWidth - 16);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    setPanelPos({ top: rect.bottom + 4, left, width });
  }, []);

  const showPanel = open && !mobileOverlayOpen && (q.trim().length >= 2 || (open && items.length === 0));

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
    if (t) saveRecentSearch(t);
    startTransition(() => {
      router.push(t ? `/tim?q=${encodeURIComponent(t)}` : "/tim");
    });
    setOpen(false);
    setMobileOverlayOpen(false);
    onSubmitExtra?.();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (composingRef.current) return;
    const term = readInput();
    applyQuery(term, false);
    if (active >= 0 && items[active]) {
      navigatingRef.current = true;
      if (term) saveRecentSearch(term);
      window.location.href = productHref(items[active]);
      return;
    }
    goSearchPage(term);
  };

  const handleSelectKeyword = (kw: string) => {
    applyQuery(kw);
    saveRecentSearch(kw);
    goSearchPage(kw);
  };

  const handleDeleteRecent = (kw: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeRecentSearch(kw);
    setRecentSearches(getRecentSearches());
  };

  const handleClearAllRecent = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  const showEmpty = !err && !loading && items.length === 0 && q.trim().length >= 2;

  // Desktop Dropdown Panel
  const panel = showPanel ? (
    <div
      ref={panelRef}
      id={listId}
      role="listbox"
      onMouseDown={(e) => e.preventDefault()}
      className="max-h-[min(70vh,420px)] overflow-auto rounded-xl border border-[var(--aloha-line)] bg-white shadow-2xl animate-fade-up flex flex-col"
      style={{
        position: "fixed",
        top: panelPos.top,
        left: panelPos.left,
        width: panelPos.width,
        zIndex: PANEL_Z,
      }}
    >
      {q.trim().length < 2 ? (
        <div className="p-3.5 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Flame size={14} className="text-orange-500 fill-orange-500" />
            <span>Tìm kiếm phổ biến</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {POPULAR_SEARCHES.map((kw) => (
              <button
                key={kw.label}
                type="button"
                onClick={() => handleSelectKeyword(kw.query)}
                className="rounded-full bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 border border-transparent px-3 py-1 text-xs font-medium text-slate-700 transition cursor-pointer"
              >
                {kw.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
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
                    if (q.trim()) saveRecentSearch(q.trim());
                  }}
                />
              </li>
            ))}
          </ul>
          {total > items.length ? (
            <button
              type="button"
              className="w-full border-t border-[var(--aloha-line)] px-4 py-2.5 text-center text-sm font-semibold text-[var(--aloha-green)] hover:bg-[var(--aloha-cream)] cursor-pointer"
              onClick={() => goSearchPage(readInput() || q)}
            >
              Xem tất cả {total} kết quả
            </button>
          ) : items.length > 0 ? (
            <button
              type="button"
              className="w-full border-t border-[var(--aloha-line)] px-4 py-2.5 text-center text-sm font-semibold text-[var(--aloha-green)] hover:bg-[var(--aloha-cream)] cursor-pointer"
              onClick={() => goSearchPage(readInput() || q)}
            >
              Xem trang kết quả tìm kiếm
            </button>
          ) : null}
        </>
      )}
    </div>
  ) : null;

  // Mobile Full-screen Overlay (Shopee / TikTok Shop Standard)
  const mobileOverlay = mobileOverlayOpen ? (
    <div className="fixed inset-0 z-[300] flex flex-col bg-white md:hidden animate-in fade-in duration-150">
      {/* Top Header Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 bg-white px-3 py-2.5 shrink-0 shadow-2xs">
        <button
          type="button"
          onClick={() => setMobileOverlayOpen(false)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 transition active:scale-90"
          aria-label="Quay lại"
        >
          <ArrowLeft size={20} />
        </button>

        <form onSubmit={onSubmit} className="relative flex flex-1 items-center">
          <input
            ref={mobileInputRef}
            autoFocus
            type="text"
            defaultValue={q}
            onCompositionStart={() => {
              composingRef.current = true;
            }}
            onCompositionUpdate={(e) => {
              applyQuery(e.currentTarget.value);
            }}
            onCompositionEnd={(e) => {
              composingRef.current = false;
              applyQuery(e.currentTarget.value);
            }}
            onInput={(e) => {
              applyQuery(e.currentTarget.value);
            }}
            placeholder="Tìm cây cảnh, chậu, giá thể…"
            className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 pl-9 pr-9 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          {hasClear ? (
            <button
              type="button"
              onClick={() => {
                if (mobileInputRef.current) mobileInputRef.current.value = "";
                if (inputRef.current) inputRef.current.value = "";
                setQ("");
                setHasClear(false);
                setItems([]);
                mobileInputRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:text-slate-700"
            >
              <X size={15} />
            </button>
          ) : null}
        </form>

        <button
          type="button"
          onClick={onSubmit}
          className="rounded-xl bg-[var(--aloha-green)] px-3.5 py-2 text-xs font-bold text-white shadow-2xs active:scale-95 transition"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : "Tìm"}
        </button>
      </div>

      {/* Body: Recent Searches & Trending OR Live Results */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-5 bg-[#FAFBF9]">
        {q.trim().length < 2 ? (
          <>
            {/* Lịch sử tìm kiếm gần đây */}
            {recentSearches.length > 0 ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <Clock size={13} className="text-slate-400" />
                    <span>Lịch sử tìm kiếm</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearAllRecent}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-rose-600 transition"
                  >
                    <Trash2 size={11} />
                    <span>Xóa lịch sử</span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((kw) => (
                    <span
                      key={kw}
                      onClick={() => handleSelectKeyword(kw)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs active:scale-95 transition cursor-pointer"
                    >
                      <span>{kw}</span>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteRecent(kw, e)}
                        className="rounded-full p-0.5 text-slate-400 hover:text-slate-600"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Từ khóa tìm kiếm phổ biến */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Flame size={14} className="text-orange-500 fill-orange-500" />
                <span>Tìm kiếm phổ biến</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {POPULAR_SEARCHES.map((kw) => (
                  <button
                    key={kw.label}
                    type="button"
                    onClick={() => handleSelectKeyword(kw.query)}
                    className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 shadow-2xs active:scale-95 transition hover:border-emerald-600 hover:text-emerald-800"
                  >
                    {kw.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          /* Live search items list */
          <div className="space-y-2">
            {err ? <p className="text-sm text-rose-600 bg-rose-50 p-3 rounded-xl">{err}</p> : null}
            {!err && loading && items.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-sm text-slate-400 gap-2">
                <Loader2 size={18} className="animate-spin text-emerald-600" />
                <span>Đang tìm sản phẩm…</span>
              </div>
            ) : null}
            {showEmpty ? (
              <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-2xs">
                <p>Không có sản phẩm khớp với «{q.trim()}»</p>
                <p className="mt-1 text-xs text-slate-400">Thử tìm theo từ khóa đơn giản hơn như chậu, cây, phân bón…</p>
              </div>
            ) : null}

            {items.length > 0 ? (
              <div className="overflow-hidden rounded-2xl bg-white shadow-2xs border border-slate-200/80 divide-y divide-slate-100">
                {items.map((p, i) => (
                  <SearchResultLink
                    key={p.ma}
                    product={p}
                    active={i === active}
                    router={router}
                    onNavigate={() => {
                      navigatingRef.current = true;
                      if (q.trim()) saveRecentSearch(q.trim());
                      setMobileOverlayOpen(false);
                    }}
                  />
                ))}
              </div>
            ) : null}

            {items.length > 0 ? (
              <button
                type="button"
                onClick={() => goSearchPage(readInput() || q)}
                className="w-full rounded-xl bg-emerald-50 border border-emerald-200/80 py-3 text-center text-xs font-bold text-emerald-800 shadow-2xs active:scale-98 transition"
              >
                Xem tất cả {total} kết quả tìm kiếm ›
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div ref={wrapRef} className={`relative w-full min-w-0 ${showPanel ? "z-[100]" : ""}`}>
      <form onSubmit={onSubmit} className="flex w-full min-w-0 items-stretch" role="search">
        <div className="relative flex w-full min-w-0 items-stretch overflow-hidden rounded-xl sm:rounded-2xl border border-[var(--aloha-line)] bg-white shadow-2xs focus-within:border-[var(--aloha-green)] focus-within:shadow-xs transition-all">
          <div className="relative min-w-0 flex-1">
            <Search
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[#9CA3AF]"
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
                if (window.innerWidth < 768) {
                  setMobileOverlayOpen(true);
                  return;
                }
                setOpen(true);
              }}
              onClick={() => {
                if (window.innerWidth < 768) {
                  setMobileOverlayOpen(true);
                }
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
                  if (readInput()) saveRecentSearch(readInput());
                  window.location.href = productHref(items[active]);
                }
              }}
              placeholder="Tìm sản phẩm, mã SP…"
              autoComplete="off"
              spellCheck={false}
              aria-autocomplete="list"
              aria-controls={listId}
              aria-expanded={showPanel}
              className={`min-w-0 w-full border-0 bg-transparent py-2 sm:py-2.5 pl-10 text-sm text-[var(--aloha-ink)] outline-none placeholder:text-slate-400 ${
                hasClear ? "pr-11" : "pr-2"
              }`}
            />
            {hasClear ? (
              <button
                type="button"
                aria-label="Xóa"
                className="absolute right-1 top-1/2 z-10 flex h-10 w-10 sm:h-11 sm:w-11 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-black/5 hover:text-slate-700"
                onClick={() => {
                  if (inputRef.current) inputRef.current.value = "";
                  if (mobileInputRef.current) mobileInputRef.current.value = "";
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
            className="relative z-10 inline-flex min-h-10 sm:min-h-11 w-10 sm:w-11 shrink-0 items-center justify-center bg-[var(--aloha-green)] text-sm font-bold text-white hover:bg-[var(--aloha-green-hover)] sm:w-auto sm:min-w-[5.5rem] sm:px-4 transition-colors cursor-pointer"
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
      {mounted && mobileOverlay ? createPortal(mobileOverlay, document.body) : null}
    </div>
  );
}
