"use client";
import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Gift, Heart, House, Sprout, Trophy } from "lucide-react";
import { GIFT_FILTER_OPTIONS } from "@/lib/giftFilters";
const GIFT_DETAILS = {
  "nguoi-thuong": { icon: Heart, hint: "Một món quà nhỏ, gửi nhiều yêu thương", color: "bg-rose-50 text-rose-600" },
  "gia-dinh": { icon: House, hint: "Thêm sắc xanh cho tổ ấm", color: "bg-orange-50 text-orange-600" },
  "khai-truong": { icon: Trophy, hint: "Gửi lời chúc khởi đầu thuận lợi", color: "bg-amber-50 text-amber-600" },
  "ban-lam-viec": { icon: Sprout, hint: "Một góc xanh, thêm cảm hứng mỗi ngày", color: "bg-emerald-50 text-emerald-600" },
};
export function GiftCategoryLinks({ onNavigate }: { onNavigate?: () => void }) {
  return <div className="mx-auto max-w-3xl space-y-4 px-3 py-3 sm:py-5">
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-[var(--aloha-green)]"><Gift size={22} aria-hidden="true" /></span>
      <div><h3 className="text-base font-bold text-[var(--aloha-green)] sm:text-lg">Chọn quà, gửi yêu thương</h3>
        <p className="mt-1 text-xs text-stone-500 sm:text-sm">Bạn muốn tặng ai, nhân dịp nào?</p></div>
    </div>
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {GIFT_FILTER_OPTIONS.map(option => {
        const detail = GIFT_DETAILS[option.value];
        const Icon = detail.icon;
        return <Link key={option.value} href={`/qua-tang/${option.value}`} onClick={onNavigate} className="group flex min-h-24 items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 transition hover:border-[var(--aloha-green)] hover:bg-emerald-50/40 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aloha-green)]">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${detail.color}`}><Icon size={22} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1"><span className="block text-sm font-semibold text-stone-800 group-hover:text-[var(--aloha-green)]">{option.label}</span><span className="mt-1 block text-xs leading-relaxed text-stone-500">{detail.hint}</span></div>
          <ArrowRight size={16} aria-hidden="true" className="shrink-0 text-stone-400 group-hover:text-[var(--aloha-green)]" />
        </Link>;
      })}
    </div>
    <Link href="/qua-tang/doanh-nghiep" onClick={onNavigate} className="flex items-center gap-3 rounded-2xl bg-[var(--aloha-green-light,#eef7ed)] p-4 text-[var(--aloha-green)] transition hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aloha-green)]">
      <BriefcaseBusiness size={22} aria-hidden="true" className="shrink-0" />
      <div className="flex-1"><span className="block text-sm font-bold">Quà tặng doanh nghiệp</span><span className="mt-1 block text-xs text-stone-600">Tư vấn quà tặng cho đối tác, khách hàng & đội ngũ</span></div><ArrowRight size={18} aria-hidden="true" className="shrink-0" />
    </Link>
  </div>;
}
