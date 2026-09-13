"use client";

import React, { useState } from "react";
import { Eye, FileText, LayoutTemplate, Package, Store } from "lucide-react";
import { WebsiteOverviewLite } from "./overview/WebsiteOverviewLite";
import { ShopAppearanceEditor } from "./appearance/ShopAppearanceEditor";
import { ShopWebProductsAdmin } from "./products/ShopWebProductsAdmin";
import { ShopArticlesAdmin } from "./articles/ShopArticlesAdmin";
import { WB } from "./ui";

type SubTab = "tong-quan" | "giao-dien" | "hang-hoa-web" | "bai-viet";

const TABS: { id: SubTab; label: string; Icon: typeof Eye; hint: string }[] = [
  { id: "tong-quan", label: "Tổng quan", Icon: Eye, hint: "Xem web bán hàng" },
  {
    id: "giao-dien",
    label: "Giao diện",
    Icon: LayoutTemplate,
    hint: "Trang chủ, menu & thương hiệu",
  },
  { id: "hang-hoa-web", label: "Hàng hóa web", Icon: Package, hint: "Ẩn / hiện sản phẩm" },
  { id: "bai-viet", label: "Bài viết", Icon: FileText, hint: "CMS bài viết web shop" },
];

export default function WebsiteBanHangShell() {
  const [sub, setSub] = useState<SubTab>("tong-quan");
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

        <div className="inline-flex rounded-xl border border-[#e2ddd2] bg-white/70 p-1">
          {TABS.map(({ id, label, Icon, hint }) => {
            const active = sub === id;
            return (
              <button
                key={id}
                type="button"
                title={hint}
                onClick={() => setSub(id)}
                className={`inline-flex h-9 items-center gap-2 rounded-lg border-0 px-3.5 text-[13px] font-semibold transition ${
                  active
                    ? "bg-[var(--aloha-green)] text-white shadow-sm"
                    : "bg-transparent text-slate-600 hover:bg-[var(--aloha-green-light)] hover:text-[var(--aloha-ink)]"
                }`}
                style={{ border: "none" }}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {sub === "tong-quan" ? <WebsiteOverviewLite /> : null}
        {sub === "giao-dien" ? <ShopAppearanceEditor /> : null}
        {sub === "hang-hoa-web" ? <ShopWebProductsAdmin /> : null}
        {sub === "bai-viet" ? <ShopArticlesAdmin /> : null}
      </div>
    </div>
  );
}
