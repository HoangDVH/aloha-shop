"use client";

import Link from "next/link";
import { Children, Fragment, isValidElement, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export type MobileCategoryGroup = {
  label: string;
  title: string;
  active: boolean;
  options: { id: number; label: string; href: string; active: boolean }[];
};

function flatten(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap(child =>
    isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment
      ? flatten(child.props.children) : [child]
  );
}

/** Compact mobile controls; all destinations use the existing catalog URL rules. */
export function CatalogMobileCategories({ groups, selected, filters, filterButton, clearAll, onNavigate }: {
  groups: MobileCategoryGroup[];
  selected: ReactNode[];
  filters?: ReactNode;
  filterButton?: ReactNode;
  clearAll?: ReactNode;
  onNavigate: () => void;
}) {
  const [panel, setPanel] = useState<number | "selected" | null>(null);
  const [query, setQuery] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const chips = [...selected, ...flatten(filters)];
  const group = typeof panel === "number" ? groups[panel] : undefined;
  const close = () => setPanel(null);

  useEffect(() => {
    if (panel === null) return;
    const el = dialog.current;
    if (!el) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    el.showModal();
    const media = window.matchMedia("(min-width: 640px)");
    const resize = () => { if (media.matches) setPanel(null); };
    media.addEventListener("change", resize);
    return () => {
      el.close();
      document.body.style.overflow = overflow;
      media.removeEventListener("change", resize);
    };
  }, [panel]);

  const open = (value: number | "selected") => { setQuery(""); setPanel(value); };
  const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
  const options = group?.options.filter(option => fold(option.label).includes(fold(query.trim()))) || [];

  return (
    <div className="min-w-0 space-y-3 sm:hidden">
      {groups.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Chọn nhánh danh mục">
          {groups.map((item, index) => (
            <button key={item.title} type="button" onClick={() => open(index)}
              aria-haspopup="dialog" aria-expanded={panel === index}
              className={`inline-flex h-11 shrink-0 items-center justify-between gap-3 whitespace-nowrap rounded-xl border px-3 text-[13px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-800 ${item.active ? "border-green-800/35 bg-[#f1f6f2] text-green-900" : "border-stone-200 bg-white text-stone-700"}`}>
              {item.label}<ChevronDown size={15} aria-hidden />
            </button>
          ))}
        </div>
      )}
      <div className="flex min-w-0 items-center gap-2">
        <div className="shrink-0">{filterButton}</div>
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1 [&_a]:h-10 [&_a]:max-w-[8rem] [&_a]:rounded-xl [&_a]:bg-[#f1f6f2] [&_a]:text-green-900 [&_button]:h-10 [&_button]:rounded-xl">
          {chips.slice(0, 2)}
        </div>
        {chips.length > 2 && (
          <button type="button" onClick={() => open("selected")} aria-haspopup="dialog"
            aria-label={`Xem tất cả ${chips.length} lựa chọn đang áp dụng`}
            className="h-10 shrink-0 rounded-xl border border-stone-200 bg-white px-3 text-sm font-medium text-stone-600">
            +{chips.length - 2}
          </button>
        )}
      </div>
      {panel !== null && (
        <dialog ref={dialog} aria-labelledby={titleId} onCancel={close}
          onClick={event => { if (event.target === event.currentTarget) close(); }}
          className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none overflow-hidden rounded-t-3xl border-0 bg-white p-0 text-stone-800 shadow-xl backdrop:bg-black/35">
          <div className="flex max-h-[85dvh] flex-col pb-[env(safe-area-inset-bottom)]">
            <div className="mx-auto mt-3 h-1 w-9 shrink-0 rounded-full bg-stone-200" />
            <div className="flex shrink-0 items-center justify-between gap-3 px-5 py-3">
              <h2 id={titleId} className="min-w-0 truncate text-lg font-bold">{group?.title || "Đang áp dụng"}</h2>
              <button type="button" onClick={close} aria-label="Đóng" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-stone-100"><X size={20} /></button>
            </div>
            {group && (
              <label className="mx-5 mb-3 flex shrink-0 items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3">
                <Search size={18} className="shrink-0 text-stone-400" aria-hidden />
                <input value={query} onChange={event => setQuery(event.target.value)} aria-label="Tìm trong nhánh" placeholder="Tìm trong nhánh này" className="h-11 min-w-0 w-full bg-transparent text-base outline-none" />
              </label>
            )}
            <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pb-5">
              {group ? options.length ? options.map(option => (
                <Link key={option.id} href={option.href} scroll={false} aria-current={option.active ? "true" : undefined}
                  onClick={() => { close(); onNavigate(); }}
                  className="flex min-h-12 items-center justify-between gap-3 border-b border-stone-100 py-3 text-sm hover:text-green-800">
                  <span className="min-w-0 truncate">{option.label}</span>
                  {option.active && <Check size={18} className="shrink-0 text-green-800" aria-hidden />}
                </Link>
              )) : <p className="py-6 text-sm text-stone-500">Không tìm thấy danh mục phù hợp.</p> : (
                <div onClick={event => { if ((event.target as HTMLElement).closest("a,button")) close(); }} className="flex flex-wrap gap-2">
                  {chips}{clearAll}
                </div>
              )}
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}
