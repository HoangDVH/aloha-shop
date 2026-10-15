"use client";

import { Children, isValidElement, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Check, ChevronRight } from "lucide-react";

type Props = {
  children: ReactNode;
  value: string | number;
  disabled?: boolean;
  className?: string;
  mobilePicker?: boolean;
  onChange: (event: { target: { value: string } }) => void;
};

/** Opt-in picker: native select remains unchanged for all existing desktop forms. */
export function AddressLocationSelect({ mobilePicker = false, children, value, disabled, className, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const options = Children.toArray(children).filter(isValidElement<{ value: string | number; children: ReactNode }>).map(option => ({
    value: String(option.props.value), label: String(option.props.children),
  }));
  const placeholder = options.find(option => !option.value)?.label || "Chọn địa chỉ";
  const selected = options.find(option => option.value === String(value));
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLocaleLowerCase("vi");
  const filtered = options.filter(option => option.value && normalize(option.label).includes(normalize(query)));
  useEffect(() => {
    if (open) search.current?.focus();
  }, [open]);
  function close() {
    setOpen(false);
    setQuery("");
    if (typeof setTimeout !== "undefined") {
      setTimeout(() => {
        trigger.current?.focus();
      }, 50);
    } else {
      trigger.current?.focus();
    }
  }

  if (!mobilePicker) return <select className={className} value={value} disabled={disabled} onChange={onChange}>{children}</select>;
  return <>
    <button ref={trigger} type="button" disabled={disabled} aria-haspopup="dialog" aria-expanded={open}
      onClick={() => setOpen(true)} className={`${className || ""} flex w-full min-w-0 items-center justify-between gap-2 text-left disabled:opacity-50`}>
      <span className="min-w-0 truncate">{selected?.label || placeholder}</span><ChevronRight size={16} className="shrink-0 text-slate-400" />
    </button>
    {open && <div role="dialog" aria-modal="true" aria-label={placeholder}
      className="fixed inset-0 z-[140] flex min-w-0 max-w-full flex-col overflow-hidden bg-white text-slate-900"
      onClick={event => event.stopPropagation()}
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
        if (event.key === "Tab") {
          const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button, input'));
          if (event.shiftKey && document.activeElement === elements[0]) { event.preventDefault(); elements.at(-1)?.focus(); }
          else if (!event.shiftKey && document.activeElement === elements.at(-1)) { event.preventDefault(); elements[0]?.focus(); }
          event.stopPropagation();
        }
      }}>
      <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-slate-100 px-2 pt-[env(safe-area-inset-top)]">
        <button type="button" aria-label="Quay lại chọn địa chỉ" onClick={event => { event?.preventDefault?.(); event?.stopPropagation?.(); close(); }} className="flex h-11 w-11 shrink-0 items-center justify-center"><ArrowLeft size={20} /></button>
        <h3 className="min-w-0 text-base font-bold">{placeholder}</h3>
      </header>
      <div className="shrink-0 p-4"><input ref={search} type="search" aria-label="Tìm địa chỉ" placeholder="Tìm kiếm" value={query}
        onChange={event => setQuery(event.target.value)} className="min-h-12 w-full min-w-0 rounded-xl bg-slate-100 px-4 text-base outline-none focus:ring-2 focus:ring-[var(--aloha-green)]" /></div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
        {filtered.map(option => <button key={option.value} type="button" aria-pressed={option.value === String(value)}
          onClick={event => { event?.preventDefault?.(); event?.stopPropagation?.(); onChange({ target: { value: option.value } }); close(); }}
          className="flex min-h-12 w-full items-center justify-between gap-3 border-b border-slate-100 py-3 text-left text-sm">
          <span className="min-w-0 break-words">{option.label}</span>{option.value === String(value) && <Check size={18} className="shrink-0 text-[var(--aloha-green)]" />}
        </button>)}
        {!filtered.length && <p role="status" className="py-6 text-center text-sm text-slate-500">Không tìm thấy kết quả</p>}
      </div>
    </div>}
  </>;
}
