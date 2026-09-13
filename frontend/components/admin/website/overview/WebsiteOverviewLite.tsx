"use client";

import React from "react";
import { ExternalLink, Globe } from "lucide-react";
import { WB, WbBtn } from "../ui";

/** Lightweight overview — no IndexedDB / KiotViet sync. */
export function WebsiteOverviewLite() {
  return (
    <div className="px-5 py-8">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ background: WB.accent }}
          >
            <Globe className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-gray-900">Xem website bán hàng</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">
              Mở storefront công khai để kiểm tra giao diện, hàng hóa và bài viết đã áp dụng.
              Dùng các tab Giao diện / Hàng hóa web / Bài viết để chỉnh nội dung.
            </p>
            <div className="mt-4">
              <WbBtn variant="primary" href="/">
                <ExternalLink className="h-4 w-4" />
                Mở storefront (/)
              </WbBtn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
