"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { shortFilterLabel } from "@/components/FilterChipSection";

const PREVIEW_NAMES = 3;

type Props = {
  /** Tên attr → danh sách giá trị (đã theo mục navbar từ API facets) */
  attributes: Record<string, string[]>;
  /** Token đang chọn dạng Name:Value */
  selected: string[];
  onToggle: (token: string) => void;
  loading?: boolean;
  /** Chưa chọn nhóm → gợi ý như Shopee */
  needCategory?: boolean;
};

export function ShopAttributeFilter({
  attributes,
  selected,
  onToggle,
  loading,
  needCategory,
}: Props) {
  const names = useMemo(() => Object.keys(attributes || {}), [attributes]);
  const [expandedList, setExpandedList] = useState(false);
  const [openName, setOpenName] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [panelPos, setPanelPos] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  useEffect(() => {
    setOpenName(null);
    setExpandedList(false);
  }, [names.join("|")]);

  const placePanel = useCallback((name: string) => {
    const btn = btnRefs.current[name];
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, 200), window.innerWidth - 16);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(240, Math.max(140, openUp ? spaceAbove : spaceBelow));
    setPanelPos({
      left,
      top: openUp ? Math.max(8, rect.top - maxHeight - 4) : rect.bottom + 4,
      width,
      maxHeight,
    });
  }, []);

  useEffect(() => {
    if (!openName) {
      setPanelPos(null);
      return;
    }
    placePanel(openName);
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      const portal = document.getElementById("shop-attr-filter-portal");
      if (portal?.contains(t)) return;
      setOpenName(null);
    };
    const onReposition = () => placePanel(openName);
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [openName, placePanel]);

  if (needCategory) {
    return (
      <div className="border-t border-[#f0ebe3] pt-4">
        <h3 className="mb-2 text-sm font-bold text-[#222]">Thuộc tính</h3>
        <p className="text-xs leading-relaxed text-slate-500">
          Chọn danh mục / nhóm hàng để hiện thuộc tính tương ứng (Size, màu…).
        </p>
      </div>
    );
  }

  if (loading && !names.length) {
    return (
      <div className="border-t border-[#f0ebe3] pt-4">
        <h3 className="mb-2 text-sm font-bold text-[#222]">Thuộc tính</h3>
        <p className="text-xs text-slate-400">Đang tải…</p>
      </div>
    );
  }

  if (!names.length) return null;

  const visibleNames = expandedList ? names : names.slice(0, PREVIEW_NAMES);
  const canExpand = names.length > PREVIEW_NAMES;

  const countSelected = (name: string) =>
    selected.filter((t) => t.startsWith(`${name}:`)).length;

  const openValues = openName ? attributes[openName] || [] : [];

  return (
    <div ref={rootRef} className="border-t border-[#f0ebe3] pt-4">
      <h3 className="mb-2 text-sm font-bold text-[#222]">Thuộc tính</h3>
      <div className="space-y-2">
        {visibleNames.map((name) => {
          const isOpen = openName === name;
          const nSel = countSelected(name);
          return (
            <div key={name}>
              <button
                type="button"
                ref={(el) => {
                  btnRefs.current[name] = el;
                }}
                onClick={() => setOpenName(isOpen ? null : name)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm font-semibold uppercase tracking-wide transition ${
                  isOpen
                    ? "border-[var(--aloha-green)] text-[#1a2e1a] ring-1 ring-[var(--aloha-green)]/30"
                    : nSel
                      ? "border-[var(--aloha-green)] bg-[var(--aloha-green-light)] text-[var(--aloha-green)]"
                      : "border-[#ddd] text-slate-600 hover:border-[var(--aloha-green)]"
                }`}
              >
                <span className="truncate">{name}</span>
                {nSel > 0 ? (
                  <span className="ml-2 shrink-0 rounded-full bg-[var(--aloha-green)] px-1.5 text-[10px] font-bold text-white">
                    {nSel}
                  </span>
                ) : null}
              </button>
            </div>
          );
        })}
      </div>

      {canExpand ? (
        <button
          type="button"
          onClick={() => {
            setExpandedList((v) => !v);
            setOpenName(null);
          }}
          className="mt-2 text-sm font-medium text-slate-600 hover:text-[var(--aloha-green)]"
        >
          {expandedList ? "Thu gọn ∧" : "Mở rộng ∨"}
        </button>
      ) : null}

      {typeof document !== "undefined" &&
      openName &&
      panelPos &&
      createPortal(
        <div
          id="shop-attr-filter-portal"
          style={{
            position: "fixed",
            left: panelPos.left,
            top: panelPos.top,
            width: panelPos.width,
            maxHeight: panelPos.maxHeight,
            zIndex: 100000,
          }}
          className="overflow-y-auto rounded-lg border border-[#ddd] bg-white py-1 shadow-lg"
        >
          {openValues.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">Không có giá trị</p>
          ) : (
            openValues.map((v) => {
              const token = `${openName}:${v}`;
              const active = selected.includes(token);
              return (
                <button
                  key={token}
                  type="button"
                  title={v}
                  onClick={() => onToggle(token)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                    active
                      ? "bg-[var(--aloha-green-light)] font-semibold text-[var(--aloha-green)]"
                      : "text-slate-700 hover:bg-[#F7F3EA]"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      active
                        ? "border-[var(--aloha-green)] bg-[var(--aloha-green)] text-white"
                        : "border-[#ccc]"
                    }`}
                  >
                    {active ? <Check size={12} strokeWidth={3} /> : null}
                  </span>
                  <span className="line-clamp-2">{shortFilterLabel(v, 36)}</span>
                </button>
              );
            })
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
