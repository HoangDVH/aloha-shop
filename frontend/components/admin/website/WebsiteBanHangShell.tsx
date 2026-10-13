"use client";
import { useSearchParams } from "next/navigation";
import { ShopAppearanceEditor } from "./appearance/ShopAppearanceEditor";
import { ShopWebProductsAdmin } from "./products/ShopWebProductsAdmin";
import { ShopArticlesAdmin } from "./articles/ShopArticlesAdmin";
import { ShopGiftsAdmin } from "./gifts/ShopGiftsAdmin";
import { QuoteRequestsAdmin } from "./inquiries/QuoteRequestsAdmin";
import { websiteSection } from "./navigation";

export default function WebsiteBanHangShell() {
  const section = websiteSection(useSearchParams().get("tab"));
  const sub = section.tab;
  return <div className="wb-admin flex min-h-[70vh] flex-col">
    <style>{`
      .wb-admin button { border-style: none; appearance: none; -webkit-appearance: none; }
      .wb-admin button[class*="border-solid"], .wb-admin a[class*="border-solid"] { border-style: solid; }
    `}</style>
    <div className="min-h-0 flex-1">
      {sub === "giao-dien" && <ShopAppearanceEditor />}
      {sub === "qua-tang" && <ShopGiftsAdmin />}
      {sub === "bao-gia" && <QuoteRequestsAdmin />}
      {sub === "hang-hoa-web" && <ShopWebProductsAdmin />}
      {sub === "bai-viet" && <ShopArticlesAdmin />}
    </div>
  </div>;
}
