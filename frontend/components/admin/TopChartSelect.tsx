"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export function TopChartSelect({ label, value, options, onChange }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false), id = useId();
  const wrap = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
    const closeOutside = (e: Event) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", closeOutside); document.addEventListener("focusin", closeOutside);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("focusin", closeOutside); };
  }, [open]);
  return (
    <div ref={wrap} className="relative shrink-0">
      <button ref={trigger} type="button" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={id}
        onClick={() => setOpen(!open)} onKeyDown={e => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setOpen(true); } }}
        className={`flex h-8 items-center gap-2 rounded-lg border bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#2D5A27] focus-visible:ring-2 focus-visible:ring-[#2D5A27]/20 ${open ? "border-[#2D5A27] ring-1 ring-[#2D5A27]/30" : "border-slate-300 hover:border-[#2D5A27]"}`}>
        {options.find(o => o.value === value)?.label}<ChevronDown size={15} className={open ? "rotate-180" : ""} />
      </button>
      {open && <div ref={menu} id={id} role="listbox" aria-label={label}
        className="absolute right-0 top-full z-30 mt-1 min-w-[220px] overflow-hidden rounded-xl border border-slate-100 bg-white py-2 shadow-[0_12px_35px_rgba(15,23,42,0.18)]"
        onKeyDown={e => {
          if (e.key === "Escape") { e.preventDefault(); setOpen(false); trigger.current?.focus(); }
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
            e.preventDefault(); const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') || []);
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            const next = e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 : (index + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
            buttons[next]?.focus();
          }
        }}>
        {options.map(o => <button key={o.value} type="button" role="option" aria-selected={o.value === value} tabIndex={o.value === value ? 0 : -1}
          onClick={() => { onChange(o.value); setOpen(false); trigger.current?.focus(); }}
          className={`flex w-full items-center justify-between gap-4 px-5 py-3 text-left text-sm outline-none hover:bg-[#F0F5EE] focus:bg-[#F0F5EE] ${o.value === value ? "bg-[#EAF3E8] font-semibold text-[#2D5A27]" : "text-slate-700"}`}>
          {o.label}{o.value === value ? <Check className="h-5 w-5 text-[#2D5A27]" /> : null}
        </button>)}
      </div>}
    </div>
  );
}
