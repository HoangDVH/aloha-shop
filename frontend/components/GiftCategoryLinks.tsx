"use client";
import Link from "next/link";
import { GIFT_FILTER_OPTIONS } from "@/lib/giftFilters";
export function GiftCategoryLinks({ onNavigate }: { onNavigate?: () => void }) {
  return <div className="border-t border-[var(--aloha-line)] px-3 py-3">
    <h3 className="mb-2 text-sm font-bold text-[var(--aloha-green)]">Quà tặng theo dịp</h3>
    {GIFT_FILTER_OPTIONS.map(option => <Link key={option.value} href={`/qua-tang/${option.value}`} onClick={onNavigate} className="block min-h-11 rounded-lg px-2 py-2.5 text-xs font-semibold text-stone-700 hover:bg-emerald-50">{option.label}</Link>)}
    <Link href="/qua-tang/doanh-nghiep" onClick={onNavigate} className="block min-h-11 rounded-lg px-2 py-2.5 text-xs font-semibold text-[var(--aloha-green)] hover:bg-emerald-50">Quà tặng doanh nghiệp →</Link>
  </div>;
}
