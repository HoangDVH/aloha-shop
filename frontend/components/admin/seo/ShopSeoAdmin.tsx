"use client";

import { useEffect } from "react";
import { WbLoading } from "@/components/admin/website/ui";
import { SeoHub } from "./SeoHub";
import { SeoCategoryPanel } from "./panels/SeoCategoryPanel";
import { SeoHomePanel } from "./panels/SeoHomePanel";
import { SeoProductPanel } from "./panels/SeoProductPanel";
import { SeoRedirectsPanel } from "./panels/SeoRedirectsPanel";
import { useSeoAppearanceDraft } from "./seoQueries";
import { useSeoAdminUiStore } from "./seoUiStore";

export function ShopSeoAdmin() {
  const panel = useSeoAdminUiStore((s) => s.panel);
  const setPanel = useSeoAdminUiStore((s) => s.setPanel);
  const appearance = useSeoAppearanceDraft();

  useEffect(() => {
    return () => setPanel("hub");
  }, [setPanel]);

  if (appearance.isLoading) {
    return <WbLoading label="Đang tải cấu hình SEO…" />;
  }

  if (appearance.isError) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Không tải được SEO. Thử tải lại trang.
      </p>
    );
  }

  if (panel === "home") return <SeoHomePanel />;
  if (panel === "product") return <SeoProductPanel />;
  if (panel === "category") return <SeoCategoryPanel />;
  if (panel === "redirects") return <SeoRedirectsPanel />;
  return <SeoHub />;
}
