"use client";
import Link from "next/link";
import { GIFT_FILTER_OPTIONS } from "@/lib/giftFilters";
export function GiftFilterSection({ value, onChange, onNavigate }: { value: string; onChange: (value: string) => void; onNavigate?: () => void }) {
  return <section className="border-t border-[var(--aloha-line)] pt-4">
    <h3 className="mb-3 text-sm font-bold text-stone-900">Chọn quà theo dịp / người nhận</h3>
    <div className="flex flex-wrap gap-2">
      {GIFT_FILTER_OPTIONS.map(option => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(value === option.value ? "" : option.value)} className={`min-h-11 rounded-lg border px-3 text-sm font-semibold ${value === option.value ? "border-[var(--aloha-green)] bg-emerald-50 text-[var(--aloha-green)]" : "border-stone-200 text-stone-700"}`}>{option.label}</button>)}
    </div>
    <Link href="/qua-tang/doanh-nghiep" onClick={onNavigate} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--aloha-green)]">Quà tặng doanh nghiệp: tư vấn đặt số lượng lớn →</Link>
  </section>;
}
