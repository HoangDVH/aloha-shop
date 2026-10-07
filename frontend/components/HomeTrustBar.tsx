"use client";

import { Leaf, ShieldCheck, Truck, HeartHandshake } from "lucide-react";

const TRUST_ITEMS = [
  {
    icon: ShieldCheck,
    title: "Chất lượng tuyển chọn",
    desc: "Cây khỏe, chậu tinh xảo",
  },
  {
    icon: Leaf,
    title: "Giải pháp toàn diện",
    desc: "Chậu, cây & giá thể",
  },
  {
    icon: Truck,
    title: "Giao hàng an toàn",
    desc: "Đóng thùng chống sốc",
  },
  {
    icon: HeartHandshake,
    title: "Đồng hành trọn đời",
    desc: "Tư vấn chăm sóc miễn phí",
  },
] as const;

/**
 * Thanh Cam Kết Giá Trị (Trust Bar / USP Strip) ngay dưới Banner Trang Chủ
 * Thiết kế chuẩn các thương hiệu lớn (The Sill, Bloomscape):
 * 4 Thẻ nổi bo góc thanh lịch, viền tinh tế, trên Desktop chia đều 4 cột cân xứng,
 * trên Mobile vuốt cuộn ngang mượt mà.
 */
export function HomeTrustBar() {
  return (
    <section
      aria-label="Cam kết chất lượng và dịch vụ Aloha"
      className="border-b border-slate-100 bg-[#FAFBF9]/80 py-3 sm:py-4.5"
    >
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <ul className="-mx-3 flex snap-x scroll-px-3 gap-2.5 overflow-x-auto px-3 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-3.5 sm:px-0 sm:py-0">
          {TRUST_ITEMS.map(({ icon: Icon, title, desc }) => (
            <li
              key={title}
              className="flex w-[15.8rem] shrink-0 snap-start items-center gap-3 rounded-2xl bg-white p-3.5 sm:p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] ring-1 ring-black/[0.05] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:ring-emerald-600/20 sm:w-auto"
            >
              <span className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[var(--aloha-green,#2D5A27)] ring-1 ring-emerald-600/10">
                <Icon size={20} strokeWidth={2.2} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-[13.5px] font-bold text-slate-900 tracking-tight leading-snug">
                  {title}
                </p>
                <p className="mt-0.5 text-[11px] sm:text-[11.5px] text-slate-500 leading-tight">
                  {desc}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
