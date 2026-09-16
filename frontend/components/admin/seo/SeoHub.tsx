"use client";

import {
  ArrowRightLeft,
  Box,
  ChevronRight,
  Home,
  Search,
  Shirt,
} from "lucide-react";
import { SHOP_ORIGIN } from "@/lib/seo";
import { SeoStatusChip } from "./fields/SeoFieldBits";
import { useSeoRedirects, useSeoAppearanceDraft } from "./seoQueries";
import { useSeoAdminUiStore, type SeoPanel } from "./seoUiStore";

const CARDS: {
  id: Exclude<SeoPanel, "hub">;
  label: string;
  Icon: typeof Home;
}[] = [
  { id: "home", label: "Trang chủ", Icon: Home },
  { id: "product", label: "Chi tiết hàng hóa", Icon: Shirt },
  { id: "category", label: "Danh mục hàng hóa", Icon: Box },
  { id: "redirects", label: "Chuyển hướng 301", Icon: ArrowRightLeft },
];

export function SeoHub() {
  const setPanel = useSeoAdminUiStore((s) => s.setPanel);
  const appearance = useSeoAppearanceDraft();
  const redirects = useSeoRedirects();
  const seo = appearance.data?.published?.theme?.seo || appearance.data?.draft?.theme?.seo;
  const titleOk = Boolean(seo?.title?.trim());
  const ogOk = Boolean(seo?.ogImageUrl?.trim());
  const tplOk = Boolean(seo?.productTitleTemplate?.trim());
  const redirectCount = redirects.data?.items?.length || 0;

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--aloha-green)] text-white shadow-sm">
          <Search className="h-5 w-5" />
        </div>
        <h1 className="mt-2 text-xl font-bold tracking-tight text-[var(--aloha-ink)]">
          Tối ưu hóa tìm kiếm (SEO)
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Nâng cao sự hiện diện trên Google và mạng xã hội — chỉnh tiêu đề, mô tả,
          ảnh chia sẻ và chuyển hướng link cũ.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <SeoStatusChip ok={titleOk} label={titleOk ? "Title trang chủ OK" : "Thiếu title trang chủ"} />
        <SeoStatusChip
          ok={ogOk}
          warn={!ogOk}
          label={ogOk ? "Có ảnh OG" : "Chưa có ảnh OG"}
        />
        <SeoStatusChip
          ok={tplOk}
          warn={!tplOk}
          label={tplOk ? "Template SP OK" : "Template SP trống"}
        />
        <SeoStatusChip
          ok={redirectCount > 0}
          warn={redirectCount === 0}
          label={`${redirectCount} redirect`}
        />
      </div>

      <div className="rounded-2xl border border-[#e8eaed] bg-white p-4 shadow-sm sm:p-5">
        <p className="mb-3 text-[13px] font-bold text-slate-800">
          Thiết lập SEO theo trang website
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {CARDS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPanel(id)}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 text-left transition hover:border-[var(--aloha-green)]/40 hover:bg-[var(--aloha-green-light)]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[var(--aloha-green)] shadow-sm ring-1 ring-slate-100">
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex-1 text-[14px] font-semibold text-slate-800">
                {label}
              </span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-[13px]">
        <a
          href={`${SHOP_ORIGIN}/sitemap.xml`}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-[var(--aloha-green)] hover:underline"
        >
          Xem sitemap.xml
        </a>
        <span className="text-slate-300">·</span>
        <a
          href={`${SHOP_ORIGIN}/robots.txt`}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-[var(--aloha-green)] hover:underline"
        >
          Xem robots.txt
        </a>
      </div>
    </div>
  );
}
