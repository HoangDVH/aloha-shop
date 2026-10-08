"use client";

import React, { useEffect, useState } from "react";
import { Eye, FileText, Gift, LayoutTemplate, Package, Store } from "lucide-react";
import { WebsiteOverviewLite } from "./overview/WebsiteOverviewLite";
import { ShopAppearanceEditor } from "./appearance/ShopAppearanceEditor";
import { ShopWebProductsAdmin } from "./products/ShopWebProductsAdmin";
import { ShopArticlesAdmin } from "./articles/ShopArticlesAdmin";
import { ShopGiftsAdmin } from "./gifts/ShopGiftsAdmin";
import { QuoteRequestsAdmin, QUOTE_COUNT_EVENT } from "./inquiries/QuoteRequestsAdmin";
import { adminFetch } from "@/components/admin/api/adminFetch";
import { WB } from "./ui";

type SubTab = "tong-quan" | "giao-dien" | "qua-tang" | "bao-gia" | "hang-hoa-web" | "bai-viet";

const TABS: { id: SubTab; label: string; Icon: typeof Eye; hint: string }[] = [
  { id: "tong-quan", label: "Tổng quan", Icon: Eye, hint: "Xem web bán hàng" },
  {
    id: "giao-dien",
    label: "Giao diện",
    Icon: LayoutTemplate,
    hint: "Trang chủ, menu & thương hiệu",
  },
  { id: "qua-tang", label: "Quà tặng", Icon: Gift, hint: "Thẻ quà tặng trang chủ & sự kiện" },
  { id: "bao-gia", label: "Yêu cầu báo giá", Icon: FileText, hint: "Tiếp nhận báo giá B2B & tư vấn quà tặng" },
  { id: "hang-hoa-web", label: "Hàng hóa web", Icon: Package, hint: "Ẩn / hiện sản phẩm" },
  { id: "bai-viet", label: "Bài viết", Icon: FileText, hint: "CMS bài viết web shop" },
];

export default function WebsiteBanHangShell() {
  const [sub, setSub] = useState<SubTab>("tong-quan");
  const [newQuotes, setNewQuotes] = useState(0);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try { const data = await adminFetch<{ newCount: number }>("/api/shop/admin/quote-requests/counts"); if (active) setNewQuotes(data.newCount); } catch { /* next refresh */ }
    };
    void refresh();
    const timer = setInterval(refresh, 60_000);
    window.addEventListener(QUOTE_COUNT_EVENT, refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener(QUOTE_COUNT_EVENT, refresh); };
  }, []);
  const isEditor = sub === "giao-dien";

  return (
    <div className="wb-admin flex min-h-[70vh] flex-col gap-4">
      <style>{`
        .wb-admin button {
          border-style: none;
          appearance: none;
          -webkit-appearance: none;
        }
        .wb-admin button[class*="border-solid"],
        .wb-admin a[class*="border-solid"] {
          border-style: solid;
        }
      `}</style>

      <header className="shrink-0 space-y-3">
        {!isEditor ? (
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
              style={{ background: WB.accent }}
            >
              <Store className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold tracking-tight text-[var(--aloha-ink)]">
                Website bán hàng
              </h1>
              <p className="truncate text-sm text-slate-500">
                Quản lý giao diện shop · hàng hóa · bài viết
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex max-w-full overflow-x-auto pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="inline-flex shrink-0 rounded-xl border border-[#e2ddd2] bg-white/70 p-1">
            {TABS.map(({ id, label, Icon, hint }) => {
              const active = sub === id;
              return (
                <button
                  key={id}
                  type="button"
                  title={hint}
                  onClick={() => setSub(id)}
                  className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border-0 px-3.5 text-[13px] font-semibold transition ${
                    active
                      ? "!bg-[#2D5A27] !text-white shadow-sm [&_svg]:!text-white"
                      : "bg-transparent text-slate-600 hover:!bg-[#F0F5EE] hover:!text-slate-900 [&_svg]:text-slate-400"
                  }`}
                  style={
                    active
                      ? { backgroundColor: "#2D5A27", color: "#ffffff", border: "none" }
                      : { border: "none" }
                  }
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {id === "bao-gia" && newQuotes > 0 ? <span className="rounded-full bg-orange-100 px-1.5 text-xs text-orange-800">{newQuotes}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {sub === "tong-quan" ? <WebsiteOverviewLite /> : null}
        {sub === "giao-dien" ? <ShopAppearanceEditor /> : null}
        {sub === "qua-tang" ? <ShopGiftsAdmin /> : null}
        {sub === "bao-gia" ? <QuoteRequestsAdmin /> : null}
        {sub === "hang-hoa-web" ? <ShopWebProductsAdmin /> : null}
        {sub === "bai-viet" ? <ShopArticlesAdmin /> : null}
      </div>
    </div>
  );
}
