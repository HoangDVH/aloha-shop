"use client";

import Link from "next/link";

export const GIFT_CATEGORIES = [
  { key: "all", label: "Tất cả gợi ý", href: "/qua-tang" },
  { key: "nguoi-thuong", label: "🌸 Dành Cho Nàng (20/10)", href: "/qua-tang/nguoi-thuong" },
  { key: "gia-dinh", label: "🏡 Gia Đình & Mẹ", href: "/qua-tang/gia-dinh" },
  { key: "khai-truong", label: "🏢 Khai Trương & Thăng Chức", href: "/qua-tang/khai-truong" },
  { key: "ban-lam-viec", label: "🌿 Bàn Làm Việc", href: "/qua-tang/ban-lam-viec" },
  { key: "doanh-nghiep", label: "💼 Quà Doanh Nghiệp (B2B)", href: "/qua-tang/doanh-nghiep" },
];

export function GiftCategoryNav({
  activeKey = "all",
  className = "",
}: {
  activeKey?: string;
  className?: string;
}) {
  return (
    <nav
      aria-label="Danh mục quà tặng"
      className={`flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-2 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {GIFT_CATEGORIES.map((cat) => {
        const isActive = activeKey === cat.key;
        return (
          <Link
            key={cat.key}
            href={cat.href}
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs sm:text-sm font-semibold transition duration-200 whitespace-nowrap cursor-pointer ${
              isActive
                ? "bg-[#0E5242] text-white shadow-sm ring-2 ring-[#0E5242]/20"
                : "bg-white text-stone-600 border border-stone-200/80 hover:border-emerald-300 hover:text-stone-900 hover:bg-stone-50"
            }`}
          >
            {cat.label}
          </Link>
        );
      })}
    </nav>
  );
}
